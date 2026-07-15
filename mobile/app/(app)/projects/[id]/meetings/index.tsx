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
import { getMeetings } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { meetingStatusBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Meeting } from '../../../../../types';

export default function MeetingsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMeetings(projectId);
      setMeetings(data);
    } catch {
      Alert.alert('Error', 'Failed to load meetings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Meetings' }} />
      <FlatList
        data={meetings}
        keyExtractor={(m) => m.id}
        style={{ backgroundColor: Colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
        renderItem={({ item: meeting }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/projects/${projectId}/meetings/${meeting.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.meetingNumber}>Meeting #{meeting.meeting_number}</Text>
              {meetingStatusBadge(meeting.status)}
            </View>
            <Text style={styles.title} numberOfLines={2}>{meeting.title}</Text>
            <View style={styles.meta}>
              {meeting.date && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>
                    {new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {meeting.start_time && ` at ${meeting.start_time}`}
                  </Text>
                </View>
              )}
              {meeting.location && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{meeting.location}</Text>
                </View>
              )}
              {meeting.series && (
                <View style={styles.metaItem}>
                  <Ionicons name="repeat-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{meeting.series}</Text>
                </View>
              )}
              {meeting.attendees?.length > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{meeting.attendees.length} attendees</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState title="No Meetings" message="No meetings have been scheduled for this project." />
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
  meetingNumber: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
