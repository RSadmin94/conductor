'''
import { pool } from "../db.js";

export async function listArtifacts(req, res) {
  try {
    const { projectId } = req.params;

    const result = await pool.query(
      "SELECT id, stage, type, name, content, uri, created_at FROM artifacts WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId]
    );

    // Parse JSON content for feasibility_report
    const artifacts = result.rows.map((artifact) => {
      const artifactData = {
        id: artifact.id,
        type: artifact.type,
        created_at: artifact.created_at,
      };

      // Parse content if it's JSON (like feasibility_report)
      if (artifact.content) {
        try {
          artifactData.content = JSON.parse(artifact.content);
        } catch (e) {
          artifactData.content = artifact.content;
        }
      }

      return artifactData;
    });

    res.json(artifacts);
  } catch (error) {
    console.error("Error listing artifacts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
'''
