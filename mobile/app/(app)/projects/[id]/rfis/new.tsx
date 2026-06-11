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
import { createRFI } from '../../../../../lib/api';
import { Button } from '../../../../../components/ui/Button';
import { Colors } from '../../../../../constants/colors';

export default function NewRFIScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();

  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!subject.trim()) {
      Alert.alert('Required', 'Subject is required.');
      return;
    }
    if (!question.trim()) {
      Alert.alert('Required', 'Question is required.');
      return;
    }

    setSaving(true);
    try {
      const rfi = await createRFI(projectId, {
        subject: subject.trim(),
        question: question.trim(),
        due_date: dueDate.trim() || null,
        status: 'open',
      });
      router.back();
      router.push(`/(app)/projects/${projectId}/rfis/${rfi.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create RFI.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New RFI' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Subject *">
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Clarification on structural detail"
              placeholderTextColor={Colors.textSubtle}
              returnKeyType="next"
            />
          </Field>

          <Field label="Question *">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={question}
              onChangeText={setQuestion}
              placeholder="Describe the question or issue in detail…"
              placeholderTextColor={Colors.textSubtle}
              multiline
              textAlignVertical="top"
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

          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              style={{ flex: 1 }}
            />
            <Button
              title="Create RFI"
              onPress={handleCreate}
              loading={saving}
              disabled={!subject.trim() || !question.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
  },
  multiline: {
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
