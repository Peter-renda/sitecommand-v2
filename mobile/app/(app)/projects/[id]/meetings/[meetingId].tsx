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
import { Ionicons } from '@expo/vector-icons';
import { getMeeting } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { meetingStatusBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Meeting } from '../../../../../types';

export default function MeetingDetailScreen() {
  const { id: projectId, meetingId } = useLocalSearchParams<{ id: string; meetingId: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getMeeting(projectId, meetingId);
      setMeeting(data);
    } catch {
      Alert.alert('Error', 'Failed to load meeting.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (!meeting) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.text, padding: 16 }}>Meeting not found.</Text>
      </View>
    );
  }

  const presentCount = meeting.attendees?.filter((a) => a.present).length ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: `Meeting #${meeting.meeting_number}` }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.meetingNumber}>Meeting #{meeting.meeting_number}</Text>
          {meetingStatusBadge(meeting.status)}
        </View>

        <Text style={styles.title}>{meeting.title}</Text>

        {/* Chips */}
        <View style={styles.chipRow}>
          {meeting.date && (
            <Chip icon="calendar-outline" label={
              new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
              + (meeting.start_time ? ` at ${meeting.start_time}` : '')
            } />
          )}
          {meeting.location && <Chip icon="location-outline" label={meeting.location} />}
          {meeting.series && <Chip icon="repeat-outline" label={meeting.series} />}
        </View>

        {/* Details */}
        <Section title="Details">
          <Row label="Status" value={meeting.status.replace(/_/g, ' ')} />
          {meeting.date && <Row label="Date" value={new Date(meeting.date).toLocaleDateString()} />}
          {meeting.start_time && <Row label="Start Time" value={meeting.start_time} />}
          {meeting.end_time && <Row label="End Time" value={meeting.end_time} />}
          {meeting.timezone && <Row label="Timezone" value={meeting.timezone} />}
          {meeting.location && <Row label="Location" value={meeting.location} />}
          {meeting.series && <Row label="Series" value={meeting.series} />}
          {meeting.meeting_link && <Row label="Meeting Link" value={meeting.meeting_link} />}
          <Row label="Privacy" value={meeting.is_private ? 'Private' : 'Public'} />
        </Section>

        {meeting.overview && (
          <Section title="Overview">
            <Text style={styles.bodyText}>{meeting.overview}</Text>
          </Section>
        )}

        {meeting.attendees && meeting.attendees.length > 0 && (
          <Section title={`Attendees (${meeting.attendees.length} invited · ${presentCount} present)`}>
            {meeting.attendees.map((a, i) => (
              <View key={i} style={styles.attendeeRow}>
                <View style={styles.attendeeInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{a.name?.[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View>
                    <Text style={styles.attendeeName}>{a.name}</Text>
                    {a.email && <Text style={styles.attendeeEmail}>{a.email}</Text>}
                  </View>
                </View>
                {a.present && (
                  <View style={styles.presentBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.presentText}>Present</Text>
                  </View>
                )}
              </View>
            ))}
          </Section>
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
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={13} color={Colors.textMuted} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  meetingNumber: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12, lineHeight: 26 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { color: Colors.textMuted, fontSize: 12 },
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
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  attendeeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  attendeeName: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  attendeeEmail: { color: Colors.textMuted, fontSize: 12 },
  presentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  presentText: { color: Colors.success, fontSize: 12, fontWeight: '500' },
});
