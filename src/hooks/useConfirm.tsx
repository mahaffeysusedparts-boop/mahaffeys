import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UseConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm(options: UseConfirmOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolve, setResolve] = useState<(value: boolean) => void>(() => {});

  const confirm = useCallback(() => {
    return new Promise<boolean>((res) => {
      setResolve(() => res);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolve(true);
    setIsOpen(false);
  }, [resolve]);

  const handleCancel = useCallback(() => {
    resolve(false);
    setIsOpen(false);
  }, [resolve]);

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resolve(false);
        }
        setIsOpen(open);
      }}
      title={options.title}
      description={options.description}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      destructive={options.destructive}
    />
  );

  return { confirm, ConfirmDialogComponent };
}