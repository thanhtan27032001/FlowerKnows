"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  ACTION_STATUS_VALUES,
  customerApi,
  customerKeys,
  type CustomerActionStatus,
} from "@/src/lib/api/customer";
import { actionStatusLabel } from "@/src/lib/i18n-labels";
import { ACTION_STATUS_COLORS } from "@/components/shared/status-badge";
import { Spinner } from "@/components/feedback/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  customerId: string;
  value: CustomerActionStatus;
};

export function CustomerActionStatusSelect({ customerId, value }: Props) {
  const t = useTranslations("customers.actionStatus");
  const tStatus = useTranslations("common.status");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (actionStatus: CustomerActionStatus) =>
      customerApi.updateActionStatus(customerId, actionStatus),
    onSuccess: (updatedCustomer) => {
      // Merge the response directly into cache — avoids a second GET round-trip
      queryClient.setQueryData(customerKeys.detail(customerId), updatedCustomer);
      // Mark the customer list as stale (lazy refetch on next visit)
      queryClient.invalidateQueries({
        queryKey: customerKeys.all,
        refetchType: "none",
      });
    },
  });

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? t("updateFailed")
        : null;

  const colors = ACTION_STATUS_COLORS[value];

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-2">
        <Select
          value={value}
          onValueChange={(next) => {
            if (!next || next === value) return;
            mutation.mutate(next as CustomerActionStatus);
          }}
          disabled={mutation.isPending}
        >
          <SelectTrigger
            className="h-8 w-auto min-w-[10.5rem] font-medium"
            aria-label={t("aria")}
            style={{
              backgroundColor: colors.bg,
              color: colors.fg,
              borderColor: colors.border,
            }}
          >
            <SelectValue>{actionStatusLabel(tStatus, value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ACTION_STATUS_VALUES.map((status) => {
              const optionColors = ACTION_STATUS_COLORS[status];
              return (
                <SelectItem key={status} value={status}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: optionColors.bg }}
                      aria-hidden
                    />
                    {actionStatusLabel(tStatus, status)}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {mutation.isPending && <Spinner className="size-3.5" />}
      </div>
      {errorMessage && (
        <p className="text-[0.7rem] text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
