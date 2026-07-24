"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { customerApi, customerKeys } from "@/src/lib/api/customer";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (customerId: string) => void;
};

export function CreateCustomerForm({ open, onOpenChange, onCreated }: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setPhone("");
    setAddress("");
    setFieldErrors({});
    setFormError(null);
  };

  const mutation = useMutation({
    mutationFn: customerApi.create,
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
      onOpenChange(false);
      reset();
      onCreated?.(customer.id);
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to create customer"
      );
    },
  });

  const submit = () => {
    setFormError(null);
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!phone.trim()) errors.phone = "Phone is required";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
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
      <div className="grid gap-2">
        <Label htmlFor="customer-name">Name</Label>
        <Input
          id="customer-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name"
          aria-invalid={!!fieldErrors.name}
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customer-phone">Phone</Label>
        <Input
          id="customer-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          aria-invalid={!!fieldErrors.phone}
        />
        {fieldErrors.phone && (
          <p className="text-xs text-destructive">{fieldErrors.phone}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customer-address">Address (optional)</Label>
        <Input
          id="customer-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Shipping address"
        />
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </form>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onOpenChange(false);
          reset();
        }}
      >
        Cancel
      </Button>
      <Button type="button" disabled={mutation.isPending} onClick={submit}>
        {mutation.isPending ? "Creating…" : "Create Customer"}
      </Button>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>Create Customer</SheetTitle>
            <SheetDescription>
              Add a customer to record purchases and hold tokens.
            </SheetDescription>
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
          <DialogTitle>Create Customer</DialogTitle>
          <DialogDescription>
            Add a customer to record purchases and hold tokens.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
