import pytest

from detector.preprocessing import COMMENT_TOKEN, normalize, strip_sql_comments, url_decode_repeated
from detector.rules import rule_based_predict


def test_repeated_url_decode_handles_double_encoding():
    assert url_decode_repeated("%2527%2520or%25201%253D1") == "' or 1=1"


def test_plus_is_decoded_as_space():
    assert url_decode_repeated("kaos+polos") == "kaos polos"


def test_lowercase_and_whitespace():
    assert normalize("  Kaos   POLOS\t\nHitam ") == "kaos polos hitam"


def test_block_comment_obfuscation_removed():
    assert normalize("1 UN/**/ION SEL/**/ECT") == "0 un ion sel ect"
    assert normalize("1/**/union/**/select") == "0 union select"


def test_mysql_versioned_comment_content_kept():
    assert normalize("1 /*!50000union*/ select") == "0 union select"


def test_line_comment_becomes_token():
    assert normalize("admin'-- ") == "admin'" + COMMENT_TOKEN.rstrip()
    assert "sqlcomment" in normalize("' or 1=1#")
    assert strip_sql_comments("a -- b") == "a " + COMMENT_TOKEN


def test_unicode_fullwidth_folded():
    assert normalize("ＳＥＬＥＣＴ") == "select"


def test_digits_collapsed():
    assert normalize("4092=4092") == normalize("1=1") == "0=0"


def test_html_entities_unescaped():
    assert normalize("&#39; or &#39;a&#39;=&#39;a") == "' or 'a'='a"


@pytest.mark.parametrize("value", [None, ""])
def test_empty(value):
    assert normalize(value) == ""


def test_normal_text_with_apostrophe_preserved():
    assert normalize("Jum'at O'Neil") == "jum'at o'neil"


@pytest.mark.parametrize("payload", ["' OR '1'='1", "1 UNION SELECT username, password FROM users--",
                                     "1; DROP TABLE users", "1' AND SLEEP(5)#"])
def test_rule_baseline_flags_classic_attacks(payload):
    assert rule_based_predict(payload) == 1


@pytest.mark.parametrize("payload", ["kaos polos hitam", "Jl. Sudirman No. 5, Bandar Lampung"])
def test_rule_baseline_passes_normal(payload):
    assert rule_based_predict(payload) == 0
