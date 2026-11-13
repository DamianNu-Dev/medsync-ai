import React from 'react';

import type { IconName } from '@/constants/medication';
import { getDoseLabel, getDoseTone, DoseDisplayStatus } from '@/lib/schedule';
import { Badge, BadgeTone } from '@/components/ui/Badge';

const toneMap: Record<ReturnType<typeof getDoseTone>, BadgeTone> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

const iconMap: Record<DoseDisplayStatus, IconName> = {
  taken: 'checkmark-circle',
  skipped: 'close-circle',
  due: 'alarm',
  late: 'alert-circle',
  missed: 'help-circle',
  upcoming: 'time-outline',
};

interface DoseStatusBadgeProps {
  status: DoseDisplayStatus;
  size?: 'sm' | 'md';
}

export function DoseStatusBadge({ status, size = 'md' }: DoseStatusBadgeProps) {
  return (
    <Badge
      label={getDoseLabel(status)}
      tone={toneMap[getDoseTone(status)]}
      icon={iconMap[status]}
      size={size}
    />
  );
}
