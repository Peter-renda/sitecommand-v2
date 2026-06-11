import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCommitments } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { commitmentStatusBadge, Badge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Commitment } from '../../../../../types';

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

type FilterType = 'all' | 'subcontract' | 'purchase_order';

export default function CommitmentsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getCommitments(projectId);
      setCommitments(data);
    } catch {
      Alert.alert('Error', 'Failed to load commitments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all'
    ? commitments
    : commitments.filter((c) => c.type === filter);

  const totalOriginal = filtered.reduce((s, c) => s + (c.original_contract_amount ?? 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Commitments' }} />
      <View style={styles.root}>
        {/* Type filter */}
        <View style={styles.filterRow}>
          {(['all', 'subcontract', 'purchase_order'] as FilterType[]).map((f) => {
            const label = f === 'all' ? `All (${commitments.length})` : f === 'subcontract' ? `Subcontracts (${commitments.filter((c) => c.type === 'subcontract').length})` : `Purchase Orders (${commitments.filter((c) => c.type === 'purchase_order').length})`;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary banner */}
        {filtered.length > 0 && (
          <View style={styles.summaryBanner}>
            <Text style={styles.summaryText}>
              {filtered.length} contract{filtered.length !== 1 ? 's' : ''} · Total: {formatCurrency(totalOriginal)}
            </Text>
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/projects/${projectId}/commitments/${c.id}`)}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.contractNumber}>{c.number ?? '—'}</Text>
                  <Badge label={c.type === 'subcontract' ? 'Subcontract' : 'PO'} color="cyan" />
                </View>
                {commitmentStatusBadge(c.status)}
              </View>
              <Text style={styles.company} numberOfLines={1}>
                {c.contract_company ?? 'No Company'}
              </Text>
              {c.title && <Text style={styles.title} numberOfLines={1}>{c.title}</Text>}
              <View style={styles.meta}>
                {c.original_contract_amount != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{formatCurrency(c.original_contract_amount)}</Text>
                  </View>
                )}
                {c.executed && (
                  <View style={styles.metaItem}>
                    <Ionicons name="checkmark-circle-outline" size={12} color={Colors.success} />
                    <Text style={[styles.metaText, { color: Colors.success }]}>Executed</Text>
                  </View>
                )}
                {c.start_date && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{new Date(c.start_date).toLocaleDateString()}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No Commitments"
              message={filter !== 'all' ? `No ${filter.replace('_', ' ')}s found.` : 'No commitments have been created for this project.'}
            />
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterTab: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center' },
  filterTabActive: { backgroundColor: Colors.primary + '22' },
  filterLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  filterLabelActive: { color: Colors.primary, fontWeight: '600' },
  summaryBanner: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryText: { color: Colors.textMuted, fontSize: 13 },
  list: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contractNumber: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  company: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  title: { color: Colors.textMuted, fontSize: 13 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
