import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onCheckedChange, id, disabled }: Props) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-sm outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]"
      disabled={disabled}
      id={id}
      onCheckedChange={(v) => onCheckedChange(v === true)}
    >
      <CheckboxPrimitive.Indicator>
        <Check aria-hidden className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
