"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ACTION_STATUS_LABEL,
  ACTION_STATUS_VALUES,
  customerApi,
  customerKeys,
  type CustomerActionStatus,
} from "@/src/lib/api/customer";
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
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (actionStatus: CustomerActionStatus) =>
      customerApi.updateActionStatus(customerId, actionStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(customerId),
      });
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!next || next === value) return;
        mutation.mutate(next as CustomerActionStatus);
      }}
      disabled={mutation.isPending}
    >
      <SelectTrigger
        className="h-8 w-auto min-w-[10.5rem] border-primary/30 bg-primary/5 font-medium"
        aria-label="Customer action status"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACTION_STATUS_VALUES.map((status) => (
          <SelectItem key={status} value={status}>
            {ACTION_STATUS_LABEL[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
