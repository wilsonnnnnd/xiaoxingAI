from app.utils.json_parser import extract_json_with_repair


def test_extract_json_with_repair_schema_filters_extra_keys_and_fills_defaults():
    text = '{"a": "x", "b": 2, "c": "drop"}'
    schema_hint = '{"a": "", "b": "", "missing": "dflt"}'
    out = extract_json_with_repair(text, schema_hint=schema_hint)
    assert out == {"a": "x", "b": "2", "missing": "dflt"}


def test_extract_json_with_repair_schema_coerces_bool_and_list():
    text = '{"flag": "true", "items": "oops"}'
    schema_hint = '{"flag": false, "items": []}'
    out = extract_json_with_repair(text, schema_hint=schema_hint)
    assert out == {"flag": True, "items": []}

