import { useCallback } from "react";
export function NativeSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  tactile = true,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  tactile?: boolean;
}) {
  const ref = useCallback(
    (input: HTMLInputElement | null) => {
      if (tactile) input?.setAttribute("switch", "");
      else input?.removeAttribute("switch");
    },
    [tactile],
  );
  return (
    <input
      ref={ref}
      className="native-switch"
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
