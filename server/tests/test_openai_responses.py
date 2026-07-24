import json
import unittest
from unittest.mock import patch

from utils.ai_school import (
    build_copilot_schema,
    build_daily_schedule_schema,
    build_habit_draft_schema,
    build_student_plan_schema,
)
from utils.openai_responses import OpenAIResponsesError, create_structured_response, validate_structured_output
from utils.student_import import build_column_mapping_schema


class OpenAIResponsesTests(unittest.TestCase):
    def setUp(self):
        self.schema = {
            "type": "object",
            "properties": {
                "answer": {"type": "string"},
                "actions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": ["open", "none"]},
                            "priority": {"type": "integer"},
                        },
                        "required": ["type", "priority"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["answer", "actions"],
            "additionalProperties": False,
        }

    def test_validator_accepts_exact_contract(self):
        payload = {
            "answer": "Open the dashboard.",
            "actions": [{"type": "open", "priority": 1}],
        }

        self.assertEqual(validate_structured_output(payload, self.schema), payload)

    def test_validator_rejects_missing_required_fields(self):
        with self.assertRaisesRegex(OpenAIResponsesError, "missing required field"):
            validate_structured_output({"answer": "Missing actions"}, self.schema)

    def test_validator_rejects_additional_fields(self):
        with self.assertRaisesRegex(OpenAIResponsesError, "unexpected fields"):
            validate_structured_output({
                "answer": "Extra data",
                "actions": [],
                "markdown": "not allowed",
            }, self.schema)

    def test_validator_rejects_invalid_enum_values(self):
        with self.assertRaisesRegex(OpenAIResponsesError, "value must be one of"):
            validate_structured_output({
                "answer": "Bad action",
                "actions": [{"type": "delete", "priority": 1}],
            }, self.schema)

    def test_every_ai_contract_uses_strict_required_objects(self):
        contracts = [
            build_copilot_schema(),
            build_daily_schedule_schema(),
            build_habit_draft_schema(),
            build_student_plan_schema(),
            build_column_mapping_schema(),
        ]

        def assert_strict(schema, path="$"):
            if schema.get("type") == "object":
                self.assertFalse(schema.get("additionalProperties"), path)
                self.assertEqual(set(schema.get("required") or []), set((schema.get("properties") or {}).keys()), path)
                for key, child_schema in (schema.get("properties") or {}).items():
                    assert_strict(child_schema, f"{path}.{key}")
            elif schema.get("type") == "array":
                assert_strict(schema.get("items") or {}, f"{path}[]")

        for contract in contracts:
            assert_strict(contract)

    def test_openai_request_includes_named_strict_contract_instruction(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return json.dumps({
                    "output_text": json.dumps({
                        "answer": "Open the dashboard.",
                        "actions": [],
                    })
                }).encode("utf-8")

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch(
            "utils.openai_responses.urllib.request.urlopen",
            return_value=FakeResponse(),
        ) as mocked_urlopen:
            result = create_structured_response(
                model="test-model",
                system_prompt="Be helpful.",
                user_prompt="What next?",
                schema_name="test_response_contract",
                schema=self.schema,
            )

        request_object = mocked_urlopen.call_args.args[0]
        request_payload = json.loads(request_object.data.decode("utf-8"))
        response_format = request_payload["text"]["format"]
        system_message = request_payload["input"][0]["content"]

        self.assertEqual(result["answer"], "Open the dashboard.")
        self.assertEqual(response_format["name"], "test_response_contract")
        self.assertTrue(response_format["strict"])
        self.assertEqual(response_format["schema"], self.schema)
        self.assertIn("RESPONSE CONTRACT", system_message)
        self.assertIn("Do not add prose, Markdown, code fences", system_message)


if __name__ == "__main__":
    unittest.main()
