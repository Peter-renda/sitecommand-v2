import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { createPunchListItem } from '../../../../../lib/api';
import { Button } from '../../../../../components/ui/Button';
import { Colors } from '../../../../../constants/colors';
import type { PunchListPriority } from '../../../../../types';

const PRIORITIES: PunchListPriority[] = ['low', 'medium', 'high'];

export default function NewPunchListItemScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [trade, setTrade] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PunchListPriority>('medium');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('Required', 'Title is required.');
      return;
    }
    setSaving(true);
    try {
      await createPunchListItem(projectId, {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        trade: trade.trim() || null,
        due_date: dueDate.trim() || null,
        priority,
        status: 'initiated',
      });
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create punch list item.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New Punch Item' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Field label="Title *">
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Describe the deficiency or item…"
              placeholderTextColor={Colors.textSubtle}
            />
          </Field>

          <Field label="Priority">
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.priorityLabel, priority === p && styles.priorityLabelActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Location">
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Room 204, 2nd Floor"
              placeholderTextColor={Colors.textSubtle}
            />
          </Field>

          <Field label="Trade">
            <TextInput
              style={styles.input}
              value={trade}
              onChangeText={setTrade}
              placeholder="e.g. Electrical, Plumbing"
              placeholderTextColor={Colors.textSubtle}
            />
          </Field>

          <Field label="Due Date">
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor={Colors.textSubtle}
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details…"
              placeholderTextColor={Colors.textSubtle}
              multiline
              textAlignVertical="top"
            />
          </Field>

          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button title="Create Item" onPress={handleCreate} loading={saving} disabled={!title.trim()} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 16 },
  fieldLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
  },
  multiline: { minHeight: 100 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  priorityBtnActive: { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  priorityLabel: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  priorityLabelActive: { color: Colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
