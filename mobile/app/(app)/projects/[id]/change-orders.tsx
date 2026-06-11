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
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getChangeOrders } from '../../../../lib/api';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { changeOrderStatusBadge, Badge } from '../../../../components/ui/Badge';
import { Colors } from '../../../../constants/colors';
import type { ChangeOrder, ChangeOrderType } from '../../../../types';

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-$' : '$';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

type Tab = ChangeOrderType;

export default function ChangeOrdersScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [primeOrders, setPrimeOrders] = useState<ChangeOrder[]>([]);
  const [commitmentOrders, setCommitmentOrders] = useState<ChangeOrder[]>([]);
  const [tab, setTab] = useState<Tab>('prime');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prime, commitment] = await Promise.all([
        getChangeOrders(projectId, 'prime'),
        getChangeOrders(projectId, 'commitment'),
      ]);
      setPrimeOrders(prime);
      setCommitmentOrders(commitment);
    } catch {
      Alert.alert('Error', 'Failed to load change orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const currentList = tab === 'prime' ? primeOrders : commitmentOrders;

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Change Orders' }} />
      <View style={styles.root}>
        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'prime' && styles.tabItemActive]}
            onPress={() => setTab('prime')}
          >
            <Text style={[styles.tabLabel, tab === 'prime' && styles.tabLabelActive]}>
              Prime ({primeOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'commitment' && styles.tabItemActive]}
            onPress={() => setTab('commitment')}
          >
            <Text style={[styles.tabLabel, tab === 'commitment' && styles.tabLabelActive]}>
              Commitment ({commitmentOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={currentList}
          keyExtractor={(o) => o.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item: co }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.coNumber}>
                    {tab === 'prime' ? 'PCCO' : 'CCO'}-{co.number}
                    {co.revision && ` Rev ${co.revision}`}
                  </Text>
                  {co.is_locked && (
                    <Ionicons name="lock-closed-outline" size={13} color={Colors.textMuted} />
                  )}
                </View>
                {changeOrderStatusBadge(co.status)}
              </View>

              {co.contract_name && (
                <Text style={styles.contractName} numberOfLines={1}>{co.contract_name}</Text>
              )}
              {co.title && <Text style={styles.title} numberOfLines={1}>{co.title}</Text>}

              <View style={styles.meta}>
                {co.amount != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{formatCurrency(co.amount)}</Text>
                  </View>
                )}
                {co.date_initiated && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{new Date(co.date_initiated).toLocaleDateString()}</Text>
                  </View>
                )}
                {co.change_reason && (
                  <View style={styles.metaItem}>
                    <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{co.change_reason}</Text>
                  </View>
                )}
                {co.executed && (
                  <View style={styles.metaItem}>
                    <Ionicons name="checkmark-circle-outline" size={12} color={Colors.success} />
                    <Text style={[styles.metaText, { color: Colors.success }]}>Executed</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No Change Orders"
              message={`No ${tab} change orders found.`}
            />
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  tabLabelActive: { color: Colors.primary, fontWeight: '700' },
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
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coNumber: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  contractName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  title: { color: Colors.textMuted, fontSize: 13 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
