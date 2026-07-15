"use client";

// Shared form section for the new 360-report-backed fields. Rendered in violet
// so the newly added fields are easy to spot against the standard gray forms.
// Values are persisted in each record's `report_fields` JSONB column and are
// surfaced as columns in 360 Reports.

export type ReportFieldType = "text" | "number" | "currency" | "date" | "boolean" | "textarea";

export type ReportFieldDef = {
  key: string;
  label: string;
  type?: ReportFieldType;
  /** Stored in the database (report_fields JSONB) but not rendered in forms. */
  dbOnly?: boolean;
};

export type ReportFieldValues = Record<string, unknown>;

export const REPORT_FIELD_INPUT_CLS =
  "w-full px-3 py-2 border border-violet-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-violet-600";

export default function ReportFieldsSection({
  title = "Report Fields",
  description = "New fields surfaced in 360 Reports. Values are saved with this record.",
  fields,
  values,
  onChange,
  columns = 3,
}: {
  title?: string;
  description?: string;
  fields: ReportFieldDef[];
  values: ReportFieldValues;
  onChange: (key: string, value: unknown) => void;
  columns?: 2 | 3 | 4;
}) {
  const visible = fields.filter((f) => !f.dbOnly);
  if (visible.length === 0) return null;
  const gridCls =
    columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div className="border border-violet-300 bg-violet-50/60 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-600 text-white">
          New
        </span>
        <h3 className="text-sm font-semibold text-violet-900">{title}</h3>
      </div>
      <p className="text-xs text-violet-700/80 mb-4">{description}</p>
      <div className={`grid grid-cols-1 ${gridCls} gap-x-4 gap-y-3`}>
        {visible.map((f) => (
          <ReportFieldInput
            key={f.key}
            field={f}
            value={values[f.key]}
            onChange={(v) => onChange(f.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function ReportFieldInput({
  field,
  value,
  onChange,
}: {
  field: ReportFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const type = field.type ?? "text";
  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-xs font-medium text-violet-900 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-violet-400 text-violet-600 focus:ring-violet-500"
        />
        {field.label}
      </label>
    );
  }
  const labelEl = (
    <label className="block text-xs font-medium text-violet-800 mb-1">{field.label}</label>
  );
  if (type === "textarea") {
    return (
      <div className="sm:col-span-full">
        {labelEl}
        <textarea
          rows={2}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={`${REPORT_FIELD_INPUT_CLS} resize-y`}
        />
      </div>
    );
  }
  const inputType = type === "date" ? "date" : type === "number" || type === "currency" ? "number" : "text";
  return (
    <div>
      {labelEl}
      <input
        type={inputType}
        step={type === "currency" ? "0.01" : undefined}
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          if (inputType === "number") onChange(e.target.value === "" ? null : Number(e.target.value));
          else onChange(e.target.value);
        }}
        className={REPORT_FIELD_INPUT_CLS}
      />
    </div>
  );
}
