import csv
import io
import re
import secrets
import unicodedata


EXPECTED_HEADERS = ("first_name", "last_name", "year_group", "tutor_group")
MAX_IMPORT_ROWS = 500
INNER_PERFORMANCE_EMAIL_DOMAIN = "innerperformance.co.uk"


class StudentImportError(ValueError):
    pass


def parse_csv_document(csv_text):
    text = str(csv_text or "").lstrip("\ufeff").strip()
    if not text:
        raise StudentImportError("The CSV file is empty.")

    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = [str(header or "").strip() for header in (reader.fieldnames or [])]
    if not headers:
        raise StudentImportError("The CSV file needs a header row.")

    records = []
    for raw_row in reader:
        row = {
            header: str(raw_row.get(header) or "").strip()
            for header in headers
        }
        if any(row.values()):
            records.append(row)

    if not records:
        raise StudentImportError("The CSV file does not contain any student rows.")
    if len(records) > MAX_IMPORT_ROWS:
        raise StudentImportError(f"Import a maximum of {MAX_IMPORT_ROWS} students at a time.")
    return headers, records


def is_expected_format(headers):
    return tuple(str(header).strip() for header in headers) == EXPECTED_HEADERS


def normalize_expected_records(records):
    return [
        {
            "firstName": row.get("first_name", "").strip(),
            "lastName": row.get("last_name", "").strip(),
            "yearGroup": row.get("year_group", "").strip(),
            "tutorGroup": row.get("tutor_group", "").strip(),
        }
        for row in records
    ]


def build_column_mapping_schema():
    return {
        "type": "object",
        "properties": {
            "firstNameColumn": {"type": "string"},
            "lastNameColumn": {"type": "string"},
            "fullNameColumn": {"type": "string"},
            "yearGroupColumn": {"type": "string"},
            "tutorGroupColumn": {"type": "string"},
            "notes": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "firstNameColumn",
            "lastNameColumn",
            "fullNameColumn",
            "yearGroupColumn",
            "tutorGroupColumn",
            "notes",
        ],
        "additionalProperties": False,
    }


def _mapped_value(row, mapping, key):
    column_name = str((mapping or {}).get(key) or "").strip()
    return str(row.get(column_name) or "").strip() if column_name else ""


def normalize_mapped_records(records, mapping):
    normalized = []
    for row in records:
        first_name = _mapped_value(row, mapping, "firstNameColumn")
        last_name = _mapped_value(row, mapping, "lastNameColumn")
        full_name = _mapped_value(row, mapping, "fullNameColumn")
        if full_name and not (first_name and last_name):
            name_parts = full_name.split()
            if not first_name:
                first_name = name_parts[0] if name_parts else ""
            if not last_name:
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        normalized.append({
            "firstName": first_name,
            "lastName": last_name,
            "yearGroup": _mapped_value(row, mapping, "yearGroupColumn"),
            "tutorGroup": _mapped_value(row, mapping, "tutorGroupColumn"),
        })
    return normalized


def _slug(value):
    ascii_value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", ".", ascii_value.lower()).strip(".")


def generate_student_credentials(students, existing_usernames=None, existing_emails=None):
    used_usernames = {str(value).lower() for value in (existing_usernames or set())}
    used_emails = {str(value).lower() for value in (existing_emails or set())}
    generated = []

    for index, student in enumerate(students):
        first_name = str((student or {}).get("firstName") or "").strip()
        last_name = str((student or {}).get("lastName") or "").strip()
        base_username = ".".join(part for part in (_slug(first_name), _slug(last_name)) if part)
        if not base_username:
            base_username = f"student.{index + 1}"
        base_username = base_username[:72].rstrip(".")

        username = base_username
        suffix = 2
        email = f"{username}@{INNER_PERFORMANCE_EMAIL_DOMAIN}"
        while username.lower() in used_usernames or email.lower() in used_emails:
            username = f"{base_username}.{suffix}"[:80].rstrip(".")
            email = f"{username}@{INNER_PERFORMANCE_EMAIL_DOMAIN}"
            suffix += 1

        used_usernames.add(username.lower())
        used_emails.add(email.lower())
        generated.append({
            "rowNumber": index + 2,
            "firstName": first_name,
            "lastName": last_name,
            "yearGroup": str((student or {}).get("yearGroup") or "").strip(),
            "tutorGroup": str((student or {}).get("tutorGroup") or "").strip(),
            "username": username,
            "email": email,
            "password": f"{secrets.randbelow(1_000_000):06d}",
        })
    return generated


def validate_import_students(students, existing_usernames=None, existing_emails=None):
    existing_username_set = {str(value).lower() for value in (existing_usernames or set())}
    existing_email_set = {str(value).lower() for value in (existing_emails or set())}
    batch_usernames = set()
    batch_emails = set()
    normalized = []
    errors = []

    if not isinstance(students, list) or not students:
        return [], [{"rowNumber": None, "fields": {"students": "At least one student is required."}}]
    if len(students) > MAX_IMPORT_ROWS:
        return [], [{"rowNumber": None, "fields": {"students": f"Import a maximum of {MAX_IMPORT_ROWS} students at a time."}}]

    for index, raw_student in enumerate(students):
        student = raw_student or {}
        row_number = student.get("rowNumber") or index + 2
        first_name = str(student.get("firstName") or "").strip()
        last_name = str(student.get("lastName") or "").strip()
        username = str(student.get("username") or "").strip()
        email = str(student.get("email") or "").strip().lower()
        password = str(student.get("password") or "").strip()
        year_group = str(student.get("yearGroup") or "").strip()
        tutor_group = str(student.get("tutorGroup") or "").strip()
        field_errors = {}

        if not first_name:
            field_errors["firstName"] = "First name is required."
        if not last_name:
            field_errors["lastName"] = "Last name is required."
        if not re.fullmatch(r"[A-Za-z0-9._-]{3,80}", username):
            field_errors["username"] = "Use 3-80 letters, numbers, dots, hyphens, or underscores."
        elif username.lower() in existing_username_set:
            field_errors["username"] = "This username already exists."
        elif username.lower() in batch_usernames:
            field_errors["username"] = "This username is duplicated in the import."
        if not re.fullmatch(rf"[A-Za-z0-9._+-]+@{re.escape(INNER_PERFORMANCE_EMAIL_DOMAIN)}", email, re.IGNORECASE):
            field_errors["email"] = f"Email must end in @{INNER_PERFORMANCE_EMAIL_DOMAIN}."
        elif email in existing_email_set:
            field_errors["email"] = "This email already exists."
        elif email in batch_emails:
            field_errors["email"] = "This email is duplicated in the import."
        if not re.fullmatch(r"\d{6}", password):
            field_errors["password"] = "Password must be exactly 6 digits."
        if len(first_name) > 80 or len(last_name) > 80:
            field_errors["name"] = "Names must be 80 characters or fewer."
        if len(year_group) > 40:
            field_errors["yearGroup"] = "Year group must be 40 characters or fewer."
        if len(tutor_group) > 120:
            field_errors["tutorGroup"] = "Tutor group must be 120 characters or fewer."

        if username:
            batch_usernames.add(username.lower())
        if email:
            batch_emails.add(email)
        normalized.append({
            "rowNumber": row_number,
            "firstName": first_name,
            "lastName": last_name,
            "yearGroup": year_group,
            "tutorGroup": tutor_group,
            "username": username,
            "email": email,
            "password": password,
        })
        if field_errors:
            errors.append({"rowNumber": row_number, "fields": field_errors})

    return normalized, errors
