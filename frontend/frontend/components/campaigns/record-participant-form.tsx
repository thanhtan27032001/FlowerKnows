"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
} from "@/src/lib/api/campaign";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-is-mobile";

type Mode = "existing" | "new";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
};

export function RecordParticipantForm({
  open,
  onOpenChange,
  campaign,
}: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("existing");
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [bagsPurchased, setBagsPurchased] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const bagsRemaining = campaign.totalBags - campaign.bagsSold;

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: customerKeys.search({ q: search }),
    queryFn: () => customerApi.search({ q: search }),
    enabled: open && mode === "existing",
  });

  const existingParticipant = useMemo(() => {
    if (!customerId) return null;
    return (
      campaign.participants.find((p) => p.customerId === customerId) ?? null
    );
  }, [campaign.participants, customerId]);

  const reset = () => {
    setMode("existing");
    setCustomerId("");
    setSearch("");
    setNewName("");
    setNewPhone("");
    setBagsPurchased("");
    setFieldErrors({});
    setFormError(null);
  };

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof campaignApi.recordParticipant>[1]) =>
      campaignApi.recordParticipant(campaign.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: campaignKeys.detail(campaign.id),
      });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
      onOpenChange(false);
      reset();
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to record participant"
      );
    },
  });

  const validateAndSubmit = () => {
    setFormError(null);
    const errors: Record<string, string> = {};
    const bags = Number(bagsPurchased);

    if (
      !bagsPurchased ||
      Number.isNaN(bags) ||
      bags < 1 ||
      !Number.isInteger(bags)
    ) {
      errors.bagsPurchased = "Bags purchased must be a whole number ≥ 1";
    } else if (bags > bagsRemaining) {
      errors.bagsPurchased = `Only ${bagsRemaining} bags remaining`;
    }

    if (mode === "existing") {
      if (!customerId) errors.customerId = "Select a customer";
    } else {
      if (!newName.trim()) errors.newName = "Name is required";
      if (!newPhone.trim()) errors.newPhone = "Phone is required";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (mode === "existing") {
      mutation.mutate({ customerId, bagsPurchased: bags });
    } else {
      mutation.mutate({
        newCustomer: {
          name: newName.trim(),
          phone: newPhone.trim(),
        },
        bagsPurchased: bags,
      });
    }
  };

  const formBody = (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "existing" ? "default" : "outline"}
          onClick={() => {
            setMode("existing");
            setFieldErrors({});
            setFormError(null);
          }}
        >
          Existing customer
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "new" ? "default" : "outline"}
          onClick={() => {
            setMode("new");
            setCustomerId("");
            setFieldErrors({});
            setFormError(null);
          }}
        >
          Create new customer
        </Button>
      </div>

      {mode === "existing" ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="participant-search">Search customer</Label>
            <Input
              id="participant-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or phone"
            />
          </div>

          <div className="grid gap-2">
            <Label>Customer</Label>
            <Select
              value={customerId || undefined}
              onValueChange={(value) => {
                setCustomerId(String(value ?? ""));
                setFormError(null);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue
                  placeholder={
                    customersLoading ? "Loading…" : "Select customer"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` — ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.customerId && (
              <p className="text-xs text-destructive">{fieldErrors.customerId}</p>
            )}
          </div>

          {existingParticipant && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              This customer already participated ({existingParticipant.totalBagsPurchased}{" "}
              bags). New bags will accumulate on the same row — a new participant
              will not be created.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="new-customer-name">Name</Label>
            <Input
              id="new-customer-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Customer name"
              aria-invalid={!!fieldErrors.newName}
            />
            {fieldErrors.newName && (
              <p className="text-xs text-destructive">{fieldErrors.newName}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-customer-phone">Phone</Label>
            <Input
              id="new-customer-phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number"
              aria-invalid={!!fieldErrors.newPhone}
            />
            {fieldErrors.newPhone && (
              <p className="text-xs text-destructive">{fieldErrors.newPhone}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="bags-purchased">Bags purchased</Label>
        <Input
          id="bags-purchased"
          type="number"
          min={1}
          max={bagsRemaining}
          inputMode="numeric"
          value={bagsPurchased}
          onChange={(e) => setBagsPurchased(e.target.value)}
          aria-invalid={!!fieldErrors.bagsPurchased}
        />
        <p className="text-xs text-muted-foreground">
          {bagsRemaining} bags remaining in this campaign
        </p>
        {fieldErrors.bagsPurchased && (
          <p className="text-xs text-destructive">{fieldErrors.bagsPurchased}</p>
        )}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </div>
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
      <Button
        type="button"
        disabled={mutation.isPending || bagsRemaining <= 0}
        onClick={validateAndSubmit}
      >
        {mutation.isPending ? "Saving…" : "Record Participant"}
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
            <SheetTitle>Record Participant</SheetTitle>
            <SheetDescription>
              Record bags purchased for a customer in this campaign.
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Participant</DialogTitle>
          <DialogDescription>
            Record bags purchased for a customer in this campaign.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
