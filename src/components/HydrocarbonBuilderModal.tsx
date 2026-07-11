"use client";

import type { BuilderState } from "@/lib/molecule";

import HydrocarbonBuilderWorkspace from "@/components/HydrocarbonBuilderWorkspace";

interface HydrocarbonBuilderModalProps {
  isOpen: boolean;
  questionLabel: string;
  state: BuilderState;
  onChange: (nextState: BuilderState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function HydrocarbonBuilderModal({
  isOpen,
  questionLabel,
  state,
  onChange,
  onClose,
  onSubmit,
}: HydrocarbonBuilderModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,23,27,0.72)] px-4 py-6 backdrop-blur-sm">
      <div className="surface-card flex max-h-[92vh] w-full max-w-6xl flex-col gap-5 overflow-auto p-5 md:p-6">
        <HydrocarbonBuilderWorkspace
          title={questionLabel}
          description="Build the carbon framework first. Hydrogens can be placed manually or added with the auto-fill action. Grading focuses on the carbon skeleton and bond order."
          state={state}
          onChange={onChange}
          primaryAction={{
            label: "Check this drawing",
            onClick: onSubmit,
            variant: "solid",
          }}
          secondaryActions={[
            {
              label: "Close",
              onClick: onClose,
              variant: "outline",
            },
          ]}
          footerNote="Use the practice board below the adaptive quiz when you want free-form drawing without a target prompt."
        />
      </div>
    </div>
  );
}