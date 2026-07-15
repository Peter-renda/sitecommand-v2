import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'cyan' | 'purple' | 'orange';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  style?: ViewStyle;
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  blue: { bg: '#1e3a5f', text: Colors.primaryLight },
  green: { bg: Colors.successBg, text: Colors.success },
  yellow: { bg: Colors.warningBg, text: Colors.warning },
  red: { bg: Colors.dangerBg, text: Colors.danger },
  gray: { bg: Colors.surfaceAlt, text: Colors.textMuted },
  cyan: { bg: Colors.infoBg, text: Colors.info },
  purple: { bg: '#2e1065', text: '#a78bfa' },
  orange: { bg: '#431407', text: '#fb923c' },
};

export function Badge({ label, color = 'gray', style }: BadgeProps) {
  const { bg, text } = colorMap[color];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

export function rfiStatusBadge(status: string) {
  const map: Record<string, BadgeColor> = {
    open: 'blue',
    closed: 'green',
    draft: 'gray',
    overdue: 'red',
  };
  return <Badge label={status.charAt(0).toUpperCase() + status.slice(1)} color={map[status] ?? 'gray'} />;
}

export function taskStatusBadge(status: string) {
  const labelMap: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    blocked: 'Blocked',
  };
  const colorMap2: Record<string, BadgeColor> = {
    not_started: 'gray',
    in_progress: 'blue',
    completed: 'green',
    blocked: 'red',
  };
  return (
    <Badge
      label={labelMap[status] ?? status}
      color={colorMap2[status] ?? 'gray'}
    />
  );
}

export function submittalStatusBadge(status: string) {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    approved_as_noted: 'Approved as Noted',
    revise_resubmit: 'Revise & Resubmit',
    rejected: 'Rejected',
  };
  const colorMap2: Record<string, BadgeColor> = {
    draft: 'gray',
    submitted: 'cyan',
    under_review: 'blue',
    approved: 'green',
    approved_as_noted: 'yellow',
    revise_resubmit: 'yellow',
    rejected: 'red',
  };
  return (
    <Badge
      label={labelMap[status] ?? status}
      color={colorMap2[status] ?? 'gray'}
    />
  );
}

export function punchStatusBadge(status: string) {
  const labelMap: Record<string, string> = {
    initiated: 'Initiated',
    ready_for_review: 'Ready for Review',
    not_accepted: 'Not Accepted',
    complete: 'Complete',
  };
  const colorMap2: Record<string, BadgeColor> = {
    initiated: 'blue',
    ready_for_review: 'yellow',
    not_accepted: 'red',
    complete: 'green',
  };
  return (
    <Badge
      label={labelMap[status] ?? status}
      color={colorMap2[status] ?? 'gray'}
    />
  );
}

export function priorityBadge(priority: string | null) {
  if (!priority) return null;
  const colorMap2: Record<string, BadgeColor> = {
    low: 'gray',
    medium: 'yellow',
    high: 'red',
  };
  return (
    <Badge
      label={priority.charAt(0).toUpperCase() + priority.slice(1)}
      color={colorMap2[priority] ?? 'gray'}
    />
  );
}

export function meetingStatusBadge(status: string) {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  const colorMap2: Record<string, BadgeColor> = {
    draft: 'gray',
    scheduled: 'blue',
    in_progress: 'cyan',
    completed: 'green',
    cancelled: 'red',
  };
  return (
    <Badge
      label={labelMap[status] ?? status}
      color={colorMap2[status] ?? 'gray'}
    />
  );
}

export function commitmentStatusBadge(status: string) {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    out_for_bid: 'Out for Bid',
    out_for_signature: 'Out for Signature',
    approved: 'Approved',
    complete: 'Complete',
    void: 'Void',
    terminated: 'Terminated',
  };
  const colorMap2: Record<string, BadgeColor> = {
    draft: 'gray',
    out_for_bid: 'cyan',
    out_for_signature: 'blue',
    approved: 'green',
    complete: 'green',
    void: 'red',
    terminated: 'red',
  };
  return (
    <Badge
      label={labelMap[status] ?? status}
      color={colorMap2[status] ?? 'gray'}
    />
  );
}

export function changeOrderStatusBadge(status: string) {
  const colorMap2: Record<string, BadgeColor> = {
    draft: 'gray',
    approved: 'green',
    rejected: 'red',
    void: 'red',
    'pending - in review': 'blue',
    'pending - revised': 'yellow',
  };
  const label = status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return <Badge label={label} color={colorMap2[status.toLowerCase()] ?? 'gray'} />;
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
