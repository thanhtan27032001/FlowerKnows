"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
} from "@/src/lib/api/campaign";
import {
  customerApi,
  customerKeys,
  type Customer,
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

const SUGGESTION_LIMIT = 20;

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
  const t = useTranslations("campaigns.recordParticipant");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [mode, setMode] = useState<Mode>("existing");
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [bagsPurchased, setBagsPurchased] = useState("1");
  const [isDraft, setIsDraft] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const bagsRemaining = campaign.totalBags - campaign.bagsSold;

  const { data: customers = [], isFetching: customersFetching } = useQuery({
    queryKey: customerKeys.search({ q: deferredSearch }),
    queryFn: () => customerApi.search({ q: deferredSearch }),
    enabled: open && mode === "existing",
  });

  const suggestions = useMemo(
    () => customers.slice(0, SUGGESTION_LIMIT),
    [customers]
  );

  const existingParticipant = useMemo(() => {
    if (!customerId) return null;
    return (
      campaign.participants.find((p) => p.customerId === customerId) ?? null
    );
  }, [campaign.participants, customerId]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [suggestionsOpen]);

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setSelectedCustomer(customer);
    setSearch(customer.name);
    setSuggestionsOpen(false);
    setFieldErrors((prev) => {
      if (!prev.customerId) return prev;
      const next = { ...prev };
      delete next.customerId;
      return next;
    });
    setFormError(null);
  };

  const resetForm = () => {
    setMode("existing");
    setCustomerId("");
    setSelectedCustomer(null);
    setSearch("");
    setSuggestionsOpen(false);
    setNewName("");
    setNewPhone("");
    setNewAddress("");
    setBagsPurchased("1");
    setIsDraft(false);
    setFieldErrors({});
    setFormError(null);
  };

  const mutation = useMutation({
    mutationFn: ({
      draft,
      input,
    }: {
      draft: boolean;
      input: Parameters<typeof campaignApi.recordParticipant>[1];
    }) =>
      draft
        ? campaignApi.createDraftParticipant(campaign.id, input)
        : campaignApi.recordParticipant(campaign.id, input),
    onSuccess: async (summary) => {
      queryClient.setQueryData(
        campaignKeys.detail(campaign.id),
        (current: CampaignDetail | undefined) => {
          if (!current) return current;
          const existing = current.participants.find((p) => p.id === summary.id);
          const deltaBags =
            summary.status === "CONFIRMED"
              ? summary.totalBagsPurchased -
                (existing?.status === "CONFIRMED"
                  ? existing.totalBagsPurchased
                  : 0)
              : 0;
          const nextParticipant = {
            ...summary,
            itemsRecorded: existing?.itemsRecorded ?? summary.itemsRecorded ?? 0,
            recordedItemNames:
              existing?.recordedItemNames?.length
                ? existing.recordedItemNames
                : (summary.recordedItemNames ?? []),
          };
          return {
            ...current,
            bagsSold: current.bagsSold + deltaBags,
            participants: existing
              ? current.participants.map((p) =>
                  p.id === summary.id ? nextParticipant : p
                )
              : [...current.participants, nextParticipant],
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        resetForm();
      });
    },
    onError: (err: unknown, variables) => {
      setFormError(
        err instanceof ApiError
          ? err.message
          : variables.draft
            ? t("draftFailed")
            : t("failed")
      );
    },
  });

  const locked = mutation.isPending || succeeded;

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
      errors.bagsPurchased = isDraft ? t("draftBagsInvalid") : t("bagsInvalid");
    } else if (!isDraft && bags > bagsRemaining) {
      errors.bagsPurchased =
        bagsRemaining <= 0 ? t("noBagsRemaining") : t("bagsInvalid");
    }

    if (mode === "existing") {
      if (!customerId) errors.customerId = t("customerRequired");
      else if (
        isDraft &&
        campaign.participants.some((p) => p.customerId === customerId)
      ) {
        errors.customerId = t("draftAlreadyParticipant");
      }
    } else {
      if (!newName.trim()) errors.newName = t("nameRequired");
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const input =
      mode === "existing"
        ? { customerId, bagsPurchased: bags }
        : {
            newCustomer: {
              name: newName.trim(),
              phone: newPhone.trim() || undefined,
              address: newAddress.trim() || undefined,
            },
            bagsPurchased: bags,
          };

    mutation.mutate({ draft: isDraft, input });
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
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
          {t("existingCustomer")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "new" ? "default" : "outline"}
          onClick={() => {
            setMode("new");
            setCustomerId("");
            setSelectedCustomer(null);
            setSearch("");
            setSuggestionsOpen(false);
            setFieldErrors({});
            setFormError(null);
          }}
        >
          {t("createNewCustomer")}
        </Button>
      </div>

      {mode === "existing" ? (
        <div className="grid gap-3">
          <div ref={searchWrapRef} className="grid gap-2">
            <Label htmlFor="participant-search">{t("searchCustomer")}</Label>
            <Input
              id="participant-search"
              value={search}
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestionsOpen}
              aria-controls="participant-customer-suggestions"
              aria-autocomplete="list"
              aria-invalid={!!fieldErrors.customerId}
              placeholder={t("nameOrPhone")}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setCustomerId("");
                setSelectedCustomer(null);
                setSuggestionsOpen(true);
                setFormError(null);
              }}
            />
            {suggestionsOpen && (
              <ul
                id="participant-customer-suggestions"
                role="listbox"
                className="max-h-48 overflow-y-auto rounded-lg bg-popover py-1 text-sm shadow-md ring-1 ring-foreground/10"
              >
                {customersFetching && suggestions.length === 0 ? (
                  <li className="px-2.5 py-2 text-muted-foreground">
                    {t("loading")}
                  </li>
                ) : suggestions.length === 0 ? (
                  <li className="px-2.5 py-2 text-muted-foreground">
                    {t("noResults")}
                  </li>
                ) : (
                  suggestions.map((customer) => (
                    <li key={customer.id} role="option">
                      <button
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomer(customer)}
                      >
                        <span className="font-medium">{customer.name}</span>
                        {customer.phone ? (
                          <span className="text-xs text-muted-foreground">
                            {customer.phone}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            {fieldErrors.customerId && (
              <p className="text-xs text-destructive">{fieldErrors.customerId}</p>
            )}
            {selectedCustomer && !fieldErrors.customerId && (
              <p className="text-xs text-muted-foreground">
                {t("selectedCustomer", {
                  name: selectedCustomer.name,
                  phone:
                    selectedCustomer.phone || tCommon("fallback.noPhone"),
                })}
              </p>
            )}
          </div>

          {existingParticipant && !isDraft && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {existingParticipant.totalBagsPurchased} · {t("bagsPurchased")}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="new-customer-name">{t("name")}</Label>
            <Input
              id="new-customer-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-invalid={!!fieldErrors.newName}
            />
            {fieldErrors.newName && (
              <p className="text-xs text-destructive">{fieldErrors.newName}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-customer-phone">{t("phone")}</Label>
            <Input
              id="new-customer-phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-customer-address">{t("address")}</Label>
            <Input
              id="new-customer-address"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="bags-purchased">{t("bagsPurchased")}</Label>
        <Input
          id="bags-purchased"
          type="number"
          min={1}
          max={isDraft ? undefined : bagsRemaining}
          inputMode="numeric"
          value={bagsPurchased}
          onChange={(e) => setBagsPurchased(e.target.value)}
          aria-invalid={!!fieldErrors.bagsPurchased}
        />
        <p className="text-xs text-muted-foreground">
          {isDraft ? t("draftNoReserveHint") : bagsRemaining}
        </p>
        {fieldErrors.bagsPurchased && (
          <p className="text-xs text-destructive">{fieldErrors.bagsPurchased}</p>
        )}
      </div>

      <label
        htmlFor="participant-is-draft"
        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5"
      >
        <input
          id="participant-is-draft"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
          checked={isDraft}
          onChange={(e) => {
            setIsDraft(e.target.checked);
            setFieldErrors({});
            setFormError(null);
          }}
        />
        <span className="min-w-0 space-y-0.5">
          <span className="block text-sm font-medium leading-none">
            {t("isDraft")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t("isDraftHint")}
          </span>
        </span>
      </label>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </fieldset>
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
          resetForm();
        }}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.saving")}
        disabled={!isDraft && bagsRemaining <= 0}
        onClick={validateAndSubmit}
      >
        {isDraft ? t("submitDraft") : t("submit")}
      </PendingButton>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      resetForm();
    }
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
