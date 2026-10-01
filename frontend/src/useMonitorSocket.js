import { useEffect, useRef, useState } from "react";
import { getToken } from "./api";

/** Subscribes to /ws/monitor and calls onDetection for every new classified input.
 *  Reconnects with backoff; sends a keep-alive ping every 25 s. */
export function useMonitorSocket(onDetection) {
  const [status, setStatus] = useState("connecting");
  const handler = useRef(onDetection);
  handler.current = onDetection;

  useEffect(() => {
    let ws;
    let ping;
    let retry;
    let attempts = 0;
    let closed = false;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws/monitor?token=${encodeURIComponent(getToken() || "")}`);
      setStatus("connecting");
      ws.onopen = () => {
        attempts = 0;
        setStatus("live");
        ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 25000);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "detection") handler.current(msg.data);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (closed) return;
        setStatus("offline");
        retry = setTimeout(connect, Math.min(10000, 1000 * 2 ** attempts++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return status;
}
