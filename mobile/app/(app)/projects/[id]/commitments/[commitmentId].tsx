import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCommitment } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { commitmentStatusBadge, Badge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Commitment, CommitmentSOVLine } from '../../../../../types';

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

type Tab = 'general' | 'sov';

export default function CommitmentDetailScreen() {
  const { id: projectId, commitmentId } = useLocalSearchParams<{ id: string; commitmentId: string }>();
  const [commitment, setCommitment] = useState<(Commitment & { schedule_of_values?: CommitmentSOVLine[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('general');

  async function load() {
    try {
      const data = await getCommitment(projectId, commitmentId);
      setCommitment(data);
    } catch {
      Alert.alert('Error', 'Failed to load commitment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (!commitment) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.text, padding: 16 }}>Commitment not found.</Text>
      </View>
    );
  }

  const revisedAmount = (commitment.original_contract_amount ?? 0)
    + (commitment.approved_change_orders ?? 0)
    + (commitment.pending_change_orders ?? 0);

  const sov = commitment.schedule_of_values ?? [];

  return (
    <>
      <Stack.Screen options={{ title: commitment.number ?? 'Commitment' }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.contractNum}>{commitment.number ?? '—'}</Text>
            <Badge label={commitment.type === 'subcontract' ? 'Subcontract' : 'PO'} color="cyan" />
          </View>
          {commitmentStatusBadge(commitment.status)}
        </View>

        <Text style={styles.company}>{commitment.contract_company ?? 'No Company'}</Text>
        {commitment.title && <Text style={styles.title}>{commitment.title}</Text>}

        {/* Summary financials */}
        <View style={styles.financials}>
          <FinCard label="Original" value={formatCurrency(commitment.original_contract_amount)} />
          <FinCard label="Approved COs" value={formatCurrency(commitment.approved_change_orders)} />
          <FinCard label="Pending COs" value={formatCurrency(commitment.pending_change_orders)} />
          <FinCard label="Revised Total" value={formatCurrency(revisedAmount)} highlight />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['general', 'sov'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabItem, tab === t && styles.tabItemActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'general' ? 'General' : `SOV (${sov.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'general' ? (
          <>
            <Section title="Contract Details">
              {commitment.number && <Row label="Contract #" value={commitment.number} />}
              <Row label="Type" value={commitment.type === 'subcontract' ? 'Subcontract' : 'Purchase Order'} />
              <Row label="Status" value={commitment.status.replace(/_/g, ' ')} />
              <Row label="Executed" value={commitment.executed ? 'Yes' : 'No'} />
              {commitment.sov_accounting_method && (
                <Row label="SOV Method" value={commitment.sov_accounting_method.replace('_', ' ')} />
              )}
              {commitment.payment_terms && <Row label="Payment Terms" value={commitment.payment_terms} />}
              {commitment.start_date && <Row label="Start Date" value={new Date(commitment.start_date).toLocaleDateString()} />}
              {commitment.estimated_completion && (
                <Row label="Est. Completion" value={new Date(commitment.estimated_completion).toLocaleDateString()} />
              )}
              {commitment.actual_completion && (
                <Row label="Actual Completion" value={new Date(commitment.actual_completion).toLocaleDateString()} />
              )}
              <Row label="Created" value={new Date(commitment.created_at).toLocaleDateString()} />
            </Section>

            {commitment.description && (
              <Section title="Description">
                <Text style={styles.bodyText}>{commitment.description}</Text>
              </Section>
            )}

            {commitment.trades && commitment.trades.length > 0 && (
              <Section title="Trades">
                <Text style={styles.bodyText}>{commitment.trades.join(', ')}</Text>
              </Section>
            )}
          </>
        ) : (
          <Section title="Schedule of Values">
            {sov.length === 0 ? (
              <Text style={styles.emptyText}>No SOV lines added.</Text>
            ) : (
              <>
                {/* Header row */}
                <View style={[styles.sovRow, styles.sovHeader]}>
                  <Text style={[styles.sovCell, { flex: 0.4 }]}>#</Text>
                  <Text style={[styles.sovCell, { flex: 2 }]}>Description</Text>
                  <Text style={[styles.sovCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
                </View>
                {sov.map((line, i) => (
                  <View key={i} style={styles.sovRow}>
                    <Text style={[styles.sovCell, { flex: 0.4, color: Colors.textMuted }]}>{line.line_number}</Text>
                    <Text style={[styles.sovCell, { flex: 2 }]} numberOfLines={2}>{line.description}</Text>
                    <Text style={[styles.sovCell, { flex: 1, textAlign: 'right', color: Colors.text }]}>
                      {formatCurrency(line.amount)}
                    </Text>
                  </View>
                ))}
                {/* Total */}
                <View style={[styles.sovRow, styles.sovTotal]}>
                  <Text style={[styles.sovCell, { flex: 0.4 }]} />
                  <Text style={[styles.sovCell, { flex: 2, color: Colors.textMuted, fontWeight: '600' }]}>Total</Text>
                  <Text style={[styles.sovCell, { flex: 1, textAlign: 'right', color: Colors.primary, fontWeight: '700' }]}>
                    {formatCurrency(sov.reduce((s, l) => s + (l.amount ?? 0), 0))}
                  </Text>
                </View>
              </>
            )}
          </Section>
        )}
      </ScrollView>
    </>
  );
}

function FinCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.finCard, highlight && styles.finCardHighlight]}>
      <Text style={styles.finLabel}>{label}</Text>
      <Text style={[styles.finValue, highlight && { color: Colors.primary }]}>{value}</Text>
    </View>
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
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contractNum: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  company: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  title: { color: Colors.textMuted, fontSize: 14, marginBottom: 16 },
  financials: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  finCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  finCardHighlight: { borderColor: Colors.primary + '44', backgroundColor: Colors.primary + '11' },
  finLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  finValue: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabItemActive: { backgroundColor: Colors.primary + '22' },
  tabLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  tabLabelActive: { color: Colors.primary, fontWeight: '600' },
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
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right', textTransform: 'capitalize' },
  bodyText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  sovRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  sovHeader: { borderBottomWidth: 2 },
  sovCell: { color: Colors.text, fontSize: 13 },
  sovTotal: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: Colors.border },
});
