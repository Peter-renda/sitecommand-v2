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
import { getChangeEvents } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { Badge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { ChangeEvent } from '../../../../../types';

function eventStatusColor(status: string): 'gray' | 'blue' | 'green' | 'yellow' | 'red' {
  const map: Record<string, 'gray' | 'blue' | 'green' | 'yellow' | 'red'> = {
    open: 'blue',
    closed: 'green',
    draft: 'gray',
    pending: 'yellow',
    void: 'red',
  };
  return map[status.toLowerCase()] ?? 'gray';
}

function formatCurrency(v: number | null | undefined) {
  if (v == null) return null;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function ChangeEventsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getChangeEvents(projectId);
      setEvents(data);
    } catch {
      Alert.alert('Error', 'Failed to load change events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Change Events' }} />
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        style={{ backgroundColor: Colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
        renderItem={({ item: event }) => {
          const totalAmount = event.line_items?.reduce((s, l) => s + (l.amount ?? 0), 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/projects/${projectId}/change-events/${event.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.eventNumber}>CE-{event.number}</Text>
                <Badge
                  label={event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  color={eventStatusColor(event.status)}
                />
              </View>
              <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
              <View style={styles.meta}>
                {event.origin && (
                  <View style={styles.metaItem}>
                    <Ionicons name="alert-circle-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{event.origin}</Text>
                  </View>
                )}
                {event.change_reason && (
                  <View style={styles.metaItem}>
                    <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{event.change_reason}</Text>
                  </View>
                )}
                {event.scope && (
                  <View style={styles.metaItem}>
                    <Ionicons name="compass-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{event.scope}</Text>
                  </View>
                )}
                {event.line_items?.length > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="list-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{event.line_items.length} line item{event.line_items.length !== 1 ? 's' : ''}</Text>
                  </View>
                )}
                {totalAmount != null && totalAmount !== 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={12} color={totalAmount >= 0 ? Colors.warning : Colors.success} />
                    <Text style={[styles.metaText, { color: totalAmount >= 0 ? Colors.warning : Colors.success }]}>
                      {formatCurrency(totalAmount)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState title="No Change Events" message="No change events have been created for this project." />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventNumber: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
