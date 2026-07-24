import json
import os
import urllib.error
import urllib.request
import uuid


OPENAI_API_URL = "https://api.openai.com/v1/responses"
SUPPORTED_SCHEMA_TYPES = {"object", "array", "string", "integer", "number", "boolean"}
STRUCTURED_CONTRACT_VERSION = 1


class OpenAIResponsesError(Exception):
    pass


def is_openai_configured():
    return bool(os.getenv("OPENAI_API_KEY"))


def structured_contract_metadata(schema_name):
    return {
        "name": schema_name,
        "version": STRUCTURED_CONTRACT_VERSION,
        "strict": True,
    }


def _schema_error(path, message):
    raise OpenAIResponsesError(f"Structured AI response failed contract validation at {path}: {message}")


def validate_structured_output(value, schema, path="$"):
    if not isinstance(schema, dict):
        _schema_error(path, "schema must be an object")

    schema_type = schema.get("type")
    if schema_type not in SUPPORTED_SCHEMA_TYPES:
        _schema_error(path, f"unsupported schema type {schema_type!r}")

    if "enum" in schema and value not in schema["enum"]:
        _schema_error(path, f"value must be one of {schema['enum']}")

    if schema_type == "object":
        if not isinstance(value, dict):
            _schema_error(path, "expected an object")
        properties = schema.get("properties") or {}
        required = schema.get("required") or []
        for required_key in required:
            if required_key not in value:
                _schema_error(path, f"missing required field {required_key!r}")
        if schema.get("additionalProperties") is False:
            unexpected = sorted(set(value) - set(properties))
            if unexpected:
                _schema_error(path, f"unexpected fields: {', '.join(unexpected)}")
        for key, item in value.items():
            if key in properties:
                validate_structured_output(item, properties[key], f"{path}.{key}")
    elif schema_type == "array":
        if not isinstance(value, list):
            _schema_error(path, "expected an array")
        if "minItems" in schema and len(value) < int(schema["minItems"]):
            _schema_error(path, f"expected at least {schema['minItems']} items")
        if "maxItems" in schema and len(value) > int(schema["maxItems"]):
            _schema_error(path, f"expected at most {schema['maxItems']} items")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                validate_structured_output(item, item_schema, f"{path}[{index}]")
    elif schema_type == "string":
        if not isinstance(value, str):
            _schema_error(path, "expected a string")
        if "minLength" in schema and len(value) < int(schema["minLength"]):
            _schema_error(path, f"expected at least {schema['minLength']} characters")
        if "maxLength" in schema and len(value) > int(schema["maxLength"]):
            _schema_error(path, f"expected at most {schema['maxLength']} characters")
    elif schema_type == "integer":
        if isinstance(value, bool) or not isinstance(value, int):
            _schema_error(path, "expected an integer")
        if "minimum" in schema and value < schema["minimum"]:
            _schema_error(path, f"must be at least {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            _schema_error(path, f"must be at most {schema['maximum']}")
    elif schema_type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            _schema_error(path, "expected a number")
        if "minimum" in schema and value < schema["minimum"]:
            _schema_error(path, f"must be at least {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            _schema_error(path, f"must be at most {schema['maximum']}")
    elif schema_type == "boolean" and not isinstance(value, bool):
        _schema_error(path, "expected a boolean")

    return value


def _extract_response_text(payload):
    direct_text = payload.get("output_text")
    if isinstance(direct_text, str) and direct_text.strip():
        return direct_text.strip()

    for item in payload.get("output", []) or []:
        for content in item.get("content", []) or []:
            if content.get("type") in {"output_text", "text"}:
                text_value = content.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    return text_value.strip()
                text_object = content.get("text") or {}
                if isinstance(text_object, dict):
                    nested_value = text_object.get("value")
                    if isinstance(nested_value, str) and nested_value.strip():
                        return nested_value.strip()
    return ""


def create_structured_response(
    *,
    model,
    system_prompt,
    user_prompt,
    schema_name,
    schema,
    max_output_tokens=1600,
):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIResponsesError("OPENAI_API_KEY is not configured on the server.")
    if not schema_name or not isinstance(schema_name, str):
        raise OpenAIResponsesError("A named structured-output contract is required.")
    if not isinstance(schema, dict) or schema.get("type") != "object":
        raise OpenAIResponsesError("The structured-output contract must be a root object schema.")

    contract_instruction = (
        f"\n\nRESPONSE CONTRACT — {schema_name}: "
        "Return exactly one JSON object matching the supplied JSON Schema. "
        "Do not add prose, Markdown, code fences, commentary, or fields outside the schema. "
        "Use empty strings or empty arrays only where the schema permits them. "
        "The application will reject any response that does not match this contract."
    )

    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": f"{system_prompt.strip()}{contract_instruction}"},
            {"role": "user", "content": user_prompt},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "schema": schema,
                "strict": True,
            }
        },
        "max_output_tokens": max_output_tokens,
    }

    request_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Client-Request-Id": str(uuid.uuid4()),
    }
    organization_id = os.getenv("OPENAI_ORGANIZATION_ID")
    project_id = os.getenv("OPENAI_PROJECT_ID")
    if organization_id:
        request_headers["OpenAI-Organization"] = organization_id
    if project_id:
        request_headers["OpenAI-Project"] = project_id

    request_data = json.dumps(payload).encode("utf-8")
    request_obj = urllib.request.Request(
        OPENAI_API_URL,
        data=request_data,
        headers=request_headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(request_obj, timeout=45) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw_body = exc.read().decode("utf-8", errors="replace")
        try:
            error_payload = json.loads(raw_body)
            error_message = (
                error_payload.get("error", {}).get("message")
                or error_payload.get("message")
                or raw_body
            )
        except json.JSONDecodeError:
            error_message = raw_body or str(exc)
        raise OpenAIResponsesError(error_message) from exc
    except urllib.error.URLError as exc:
        raise OpenAIResponsesError(str(exc.reason)) from exc

    output_text = _extract_response_text(response_payload)
    if not output_text:
        raise OpenAIResponsesError("OpenAI returned an empty response.")

    try:
        parsed_output = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise OpenAIResponsesError("OpenAI returned invalid JSON for the requested schema.") from exc
    return validate_structured_output(parsed_output, schema)
