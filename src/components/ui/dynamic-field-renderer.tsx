import type { FieldDef } from "~/lib/integration-providers";
import { Input } from "~/components/ui/input";

interface DynamicFieldRendererProps {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: DynamicFieldRendererProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={field.name} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Input
        id={field.name}
        type={field.type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}
