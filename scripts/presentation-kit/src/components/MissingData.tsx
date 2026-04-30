interface MissingField {
  key: string;
  description: string;
}

interface MissingDataProps {
  /** Header text shown below the warning icon (typically the data column name). */
  column: string;
  fields: MissingField[];
}

/**
 * Visual placeholder shown on a slide when the data needed to render it is
 * incomplete. Hidden in present-mode (see `.ims-presentation-mode .missing-data`
 * in `presentations.css`).
 */
export function MissingData({ column, fields }: MissingDataProps) {
  return (
    <div className="missing-data">
      <div className="missing-data-icon">!</div>
      <div className="missing-data-title">Missing data</div>
      <div className="missing-data-column">{column}</div>
      <div className="missing-data-fields">
        {fields.map((f) => (
          <div key={f.key} className="missing-data-field">
            <code>{f.key}</code>
            <span>{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Returns the subset of `required` fields that are missing from `data`
 * (null / undefined / empty string / empty array all count as missing).
 */
export function getMissing(
  data: Record<string, unknown> | object | undefined | null,
  required: MissingField[]
): MissingField[] {
  if (!data) {
    return required;
  }
  const record = data as Record<string, unknown>;
  return required.filter((f) => {
    const val = record[f.key];
    if (val === null || val === undefined) {
      return true;
    }
    if (typeof val === "string" && val.trim() === "") {
      return true;
    }
    if (Array.isArray(val) && val.length === 0) {
      return true;
    }
    return false;
  });
}

export type { MissingField };
