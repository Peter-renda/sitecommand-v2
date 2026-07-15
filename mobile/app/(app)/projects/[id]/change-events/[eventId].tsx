import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getChangeEvent } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { Badge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { ChangeEvent } from '../../../../../types';

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-$' : '$';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

function statusColor(status: string): 'gray' | 'blue' | 'green' | 'yellow' | 'red' {
  const map: Record<string, 'gray' | 'blue' | 'green' | 'yellow' | 'red'> = {
    open: 'blue', closed: 'green', draft: 'gray', pending: 'yellow', void: 'red',
  };
  return map[status.toLowerCase()] ?? 'gray';
}

export default function ChangeEventDetailScreen() {
  const { id: projectId, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const [event, setEvent] = useState<ChangeEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getChangeEvent(projectId, eventId);
      setEvent(data);
    } catch {
      Alert.alert('Error', 'Failed to load change event.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.text, padding: 16 }}>Change event not found.</Text>
      </View>
    );
  }

  const totalAmount = event.line_items?.reduce((s, l) => s + (l.amount ?? 0), 0) ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: `CE-${event.number}` }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.number}>CE-{event.number}</Text>
          <Badge
            label={event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            color={statusColor(event.status)}
          />
        </View>

        <Text style={styles.title}>{event.title}</Text>

        <Section title="Details">
          <Row label="Status" value={event.status.charAt(0).toUpperCase() + event.status.slice(1)} />
          {event.origin && <Row label="Origin" value={event.origin} />}
          {event.type && <Row label="Type" value={event.type} />}
          {event.change_reason && <Row label="Change Reason" value={event.change_reason} />}
          {event.scope && <Row label="Scope" value={event.scope} />}
          <Row label="Created" value={new Date(event.created_at).toLocaleDateString()} />
        </Section>

        {event.description && (
          <Section title="Description">
            <Text style={styles.bodyText}>{event.description}</Text>
          </Section>
        )}

        {event.line_items && event.line_items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Line Items ({event.line_items.length}) · Total: {formatCurrency(totalAmount)}
            </Text>
            <View style={styles.sectionBody}>
              {event.line_items.map((line, i) => (
                <View key={line.id ?? i} style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    {line.budget_code && (
                      <Text style={styles.lineCode}>{line.budget_code}</Text>
                    )}
                    {line.description && (
                      <Text style={styles.lineDesc} numberOfLines={2}>{line.description}</Text>
                    )}
                    {(line.unit_qty != null || line.unit_cost != null) && (
                      <Text style={styles.lineSub}>
                        {line.unit_qty != null && `${line.unit_qty} units`}
                        {line.unit_cost != null && ` × ${formatCurrency(line.unit_cost)}`}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.lineAmount, line.amount && line.amount < 0 ? { color: Colors.success } : { color: Colors.warning }]}>
                    {formatCurrency(line.amount ?? line.rom)}
                  </Text>
                </View>
              ))}
              {/* Total row */}
              <View style={[styles.lineRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={[styles.totalAmount, totalAmount < 0 ? { color: Colors.success } : { color: Colors.warning }]}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  number: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, lineHeight: 26 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionBody: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { color: Colors.textMuted, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  bodyText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  lineCode: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  lineDesc: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  lineSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  lineAmount: { fontSize: 14, fontWeight: '600', minWidth: 70, textAlign: 'right' },
  totalRow: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: Colors.border },
  totalLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', flex: 1 },
  totalAmount: { fontSize: 16, fontWeight: '700' },
});
