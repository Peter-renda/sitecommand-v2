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
import { getTransmittals } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { Badge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Transmittal } from '../../../../../types';

function statusColor(status: string): 'gray' | 'blue' | 'green' | 'yellow' {
  const map: Record<string, 'gray' | 'blue' | 'green' | 'yellow'> = {
    draft: 'gray',
    sent: 'blue',
    received: 'green',
    approved: 'green',
  };
  return map[status.toLowerCase()] ?? 'gray';
}

export default function TransmittalsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [transmittals, setTransmittals] = useState<Transmittal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getTransmittals(projectId);
      setTransmittals(data);
    } catch {
      Alert.alert('Error', 'Failed to load transmittals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Transmittals' }} />
      <FlatList
        data={transmittals}
        keyExtractor={(t) => t.id}
        style={{ backgroundColor: Colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/projects/${projectId}/transmittals/${t.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.number}>T-{t.transmittal_number}</Text>
              <Badge label={t.status.charAt(0).toUpperCase() + t.status.slice(1)} color={statusColor(t.status)} />
            </View>
            {t.subject && <Text style={styles.subject} numberOfLines={2}>{t.subject}</Text>}
            <View style={styles.meta}>
              {t.sent_date && (
                <View style={styles.metaItem}>
                  <Ionicons name="send-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>Sent {new Date(t.sent_date).toLocaleDateString()}</Text>
                </View>
              )}
              {t.due_by && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>Due {new Date(t.due_by).toLocaleDateString()}</Text>
                </View>
              )}
              {t.sent_via && (
                <View style={styles.metaItem}>
                  <Ionicons name="mail-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{t.sent_via}</Text>
                </View>
              )}
              {t.items?.length > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="documents-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{t.items.length} item{t.items.length !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState title="No Transmittals" message="No transmittals have been created for this project." />
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
  number: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  subject: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
