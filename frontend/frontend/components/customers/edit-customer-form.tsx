"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  customerApi,
  customerKeys,
  type Customer,
  type CustomerDetail,
} from "@/src/lib/api/customer";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";

type EditableCustomer = Pick<Customer, "id" | "name" | "phone" | "address">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: EditableCustomer | CustomerDetail | null;
};

export function EditCustomerForm({ open, onOpenChange, customer }: Props) {
  const t = useTranslations("customers.edit");
  const tCreate = useTranslations("customers.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customer) return;
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setAddress(customer.address ?? "");
    setFieldErrors({});
    setFormError(null);
    reset();
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: (input: { name: string; phone?: string; address?: string }) => {
      if (!customer) throw new Error("No customer");
      return customerApi.update(customer.id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
      if (customer) {
        await queryClient.invalidateQueries({
          queryKey: customerKeys.detail(customer.id),
        });
      }
      await runSuccess(() => {
        onOpenChange(false);
      });
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof ApiError ? err.message : t("failed")
      );
    },
  });

  const locked = mutation.isPending || succeeded || !customer;

  const submit = () => {
    setFormError(null);
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = tCreate("nameRequired");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
    });
  };

  const formBody = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-customer-name">{tCreate("name")}</Label>
          <Input
            id="edit-customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tCreate("namePlaceholder")}
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-customer-phone">{tCreate("phone")}</Label>
          <Input
            id="edit-customer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={tCreate("phonePlaceholder")}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-customer-address">{tCreate("address")}</Label>
          <Input
            id="edit-customer-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={tCreate("addressPlaceholder")}
          />
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </fieldset>
    </form>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => {
          onOpenChange(false);
          reset();
        }}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.saving")}
        onClick={submit}
      >
        {t("submit")}
      </PendingButton>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
