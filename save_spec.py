import psycopg2

SPEC_PATH = "pasted.txt"
SOURCE_MODEL = "Qwen3-Max"
VERSION = "0.1"

with open(SPEC_PATH, "r", encoding="utf-8") as f:
    content = f.read()

conn = psycopg2.connect(
    host="localhost",
    port=55432,
    dbname="conductor_db",
    user="conductor",
    password="conductor_pw",
)
conn.autocommit = True

with conn.cursor() as cur:
    cur.execute(
        "INSERT INTO projects (name) VALUES (%s) RETURNING id",
        ("Conductor MVP",)
    )
    project_id = cur.fetchone()[0]

    cur.execute(
        """INSERT INTO specs
           (project_id, version, source_model, content_markdown, status)
           VALUES (%s,%s,%s,%s,%s)
           RETURNING id""",
        (project_id, VERSION, SOURCE_MODEL, content, "draft"),
    )
    spec_id = cur.fetchone()[0]

    cur.execute(
        """INSERT INTO artifacts
           (project_id, spec_id, type)
           VALUES (%s,%s,%s)
           RETURNING id""",
        (project_id, spec_id, "architecture_spec"),
    )
    artifact_id = cur.fetchone()[0]

print("Saved successfully.")
print("project_id:", project_id)
print("spec_id:", spec_id)
print("artifact_id:", artifact_id)
