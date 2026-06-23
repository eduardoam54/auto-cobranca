import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AppButton, FormField, LoadingScreen, Screen } from '@/components/ui';
import { useApiClient } from '@/api/client';
import { useProtectedRoute } from '@/auth/auth-context';
import type {
  CollectionVisitResult,
  CompleteTaskResponse,
  FailTaskResponse,
  MobileTask,
  PaymentMethod,
} from '@/types/api';
import {
  formatCurrency,
  formatDate,
  getCollectionAmount,
  getTaskAddress,
  getTaskClientName,
} from '@/components/formatters';

// ─── Result option definitions ───────────────────────────────────────────────

type ResultOption = {
  value: CollectionVisitResult;
  label: string;
  color: string;
  bg: string;
  needsPayment: boolean;
};

const RESULT_OPTIONS: ResultOption[] = [
  { value: 'paid',             label: 'Pago',           color: '#166534', bg: '#dcfce7', needsPayment: true  },
  { value: 'partial_paid',     label: 'Parcial',        color: '#0f766e', bg: '#ccfbf1', needsPayment: true  },
  { value: 'promised_payment', label: 'Prometeu pagar', color: '#92400e', bg: '#fef3c7', needsPayment: false },
  { value: 'not_home',         label: 'Ausente',        color: '#374151', bg: '#f3f4f6', needsPayment: false },
  { value: 'refused_payment',  label: 'Recusou',        color: '#991b1b', bg: '#fee2e2', needsPayment: false },
  { value: 'rescheduled',      label: 'Reagendado',     color: '#1e40af', bg: '#dbeafe', needsPayment: false },
  { value: 'wrong_address',    label: 'End. errado',    color: '#7c2d12', bg: '#ffedd5', needsPayment: false },
  { value: 'other',            label: 'Outro',          color: '#374151', bg: '#f1f5f9', needsPayment: false },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'cash', 'pix', 'bank_slip', 'credit_card', 'debit_card', 'other',
];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  bank_slip: 'Boleto',
  credit_card: 'Credito',
  debit_card: 'Debito',
  other: 'Outro',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TaskDetailScreen() {
  useProtectedRoute();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { request, upload } = useApiClient();

  const [task, setTask] = useState<MobileTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visit registration state
  const [selectedResult, setSelectedResult] = useState<CollectionVisitResult | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<CapturedLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const taskId = Array.isArray(id) ? id[0] : id;

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setError(null);
    setLoading(true);
    try {
      const tasks = await request<MobileTask[]>('/mobile/my-tasks');
      const found = tasks.find((t) => t.id === taskId) ?? null;
      setTask(found);
      if (!found) setError('Tarefa nao encontrada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar tarefa.');
    } finally {
      setLoading(false);
    }
  }, [request, taskId]);

  useEffect(() => { void loadTask(); }, [loadTask]);

  // ── GPS ──────────────────────────────────────────────────────────────────

  async function captureLocation(): Promise<CapturedLocation | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      };
    } catch {
      return null;
    }
  }

  // ── Open visit form ───────────────────────────────────────────────────────

  async function handleOpenForm() {
    setFormOpen(true);
    setSelectedResult(null);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setPhotoUri(null);
    setError(null);
    const loc = await captureLocation();
    if (loc) setCapturedLocation(loc);
  }

  // ── Photo ─────────────────────────────────────────────────────────────────

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissao necessaria', 'Acesso a camera e necessario.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  // ── Start task ────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!task) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await request<MobileTask>(`/mobile/tasks/${task.id}/start`, {
        method: 'PATCH',
      });
      setTask({ ...task, ...updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar tarefa.');
    } finally {
      setActionLoading(false);
    }
  }

  // ── Confirm visit result ──────────────────────────────────────────────────

  async function handleConfirm() {
    if (!task || !selectedResult) return;

    const option = RESULT_OPTIONS.find((o) => o.value === selectedResult)!;
    const parsedAmount = Number(paymentAmount.replace(',', '.'));

    if (option.needsPayment) {
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError('Informe um valor recebido valido.');
        return;
      }
    }

    setActionLoading(true);
    setError(null);

    const location = capturedLocation ?? (await captureLocation());

    try {
      let visitId: string;

      if (option.needsPayment) {
        const res = await request<CompleteTaskResponse>(
          `/mobile/tasks/${task.id}/complete`,
          {
            method: 'PATCH',
            body: {
              result: selectedResult,
              notes: notes.trim() || undefined,
              paymentReceived: true,
              paymentAmount: parsedAmount,
              paymentMethod,
              latitude: location?.latitude,
              longitude: location?.longitude,
              locationAccuracy: location?.accuracy ?? undefined,
            },
          },
        );
        visitId = res.visit.id;
        setTask({ ...task, ...res.task });
      } else {
        const res = await request<FailTaskResponse>(
          `/mobile/tasks/${task.id}/fail`,
          {
            method: 'PATCH',
            body: {
              result: selectedResult,
              notes: notes.trim() || undefined,
              latitude: location?.latitude,
              longitude: location?.longitude,
              locationAccuracy: location?.accuracy ?? undefined,
            },
          },
        );
        visitId = res.visit.id;
        setTask({ ...task, ...res.task });
      }

      if (photoUri && visitId) {
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: photoUri,
            type: 'image/jpeg',
            name: 'proof.jpg',
          } as unknown as Blob);
          await upload(`/mobile/visits/${visitId}/photo`, formData);
        } catch {
          // Photo upload failure doesn't block the visit registration
        }
      }

      const resultLabel = option.label;
      Alert.alert('Resultado registrado', `Visita salva: ${resultLabel}.`, [
        { text: 'Ok', onPress: () => router.replace('/tasks') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar resultado.');
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen message="Carregando tarefa" />;

  if (!task) {
    return (
      <Screen>
        <View style={s.messageBox}>
          <Text style={s.messageText}>{error ?? 'Tarefa nao encontrada.'}</Text>
          <AppButton label="Voltar" onPress={() => router.replace('/tasks')} />
        </View>
      </Screen>
    );
  }

  const canStart = task.status === 'assigned';
  const canFinish = task.status === 'assigned' || task.status === 'in_progress';
  const isDone = task.status === 'completed' || task.status === 'failed' || task.status === 'canceled';

  const selectedOption = RESULT_OPTIONS.find((o) => o.value === selectedResult) ?? null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content}>

        {/* Header card */}
        <View style={s.card}>
          <View style={s.titleRow}>
            <Text style={s.title}>{getTaskClientName(task)}</Text>
            <StatusBadge status={task.status} />
          </View>
          <Text style={s.subtitle}>{task.title}</Text>
          {task.description ? <Text style={s.bodyText}>{task.description}</Text> : null}
        </View>

        {/* Client */}
        <Section title="Cliente">
          <Info label="Nome" value={task.client?.name} />
          <Info label="Telefone" value={task.client?.whatsappPhone ?? task.client?.phone} />
          <Info label="Bairro" value={task.client?.neighborhood} />
          <Info label="Endereco" value={getTaskAddress(task)} />
          <Info label="Observacoes" value={task.client?.notes} />
        </Section>

        {/* Collection */}
        <Section title="Cobranca">
          <Info label="Titulo" value={task.collection?.title} />
          <Info label="Valor" value={formatCurrency(getCollectionAmount(task))} />
          <Info label="Vencimento" value={formatDate(task.collection?.dueDate)} />
          <Info label="Status" value={task.collection?.status} />
          <Info label="Descricao" value={task.collection?.description} />
        </Section>

        {/* Task meta */}
        <Section title="Tarefa">
          <Info label="Prioridade" value={task.priority} />
          <Info label="Agendado para" value={formatDate(task.scheduledDate)} />
          <Info label="Horario" value={task.scheduledTime} />
          <Info label="Recomendacao da IA" value={task.aiRecommendation} />
        </Section>

        {/* Done state */}
        {isDone ? (
          <View style={s.doneCard}>
            <Text style={s.doneText}>Esta tarefa ja foi finalizada.</Text>
            <AppButton
              label="Voltar para tarefas"
              variant="ghost"
              onPress={() => router.replace('/tasks')}
            />
          </View>
        ) : null}

        {/* Start button */}
        {canStart && !formOpen ? (
          <AppButton
            label="Iniciar tarefa"
            loading={actionLoading}
            onPress={handleStart}
          />
        ) : null}

        {/* Register visit */}
        {canFinish && !formOpen ? (
          <AppButton
            label="Registrar resultado da visita"
            variant="secondary"
            onPress={handleOpenForm}
          />
        ) : null}

        {/* Visit form */}
        {formOpen ? (
          <View style={s.formCard}>
            <Text style={s.formTitle}>Resultado da visita</Text>

            {/* GPS status */}
            {capturedLocation ? (
              <View style={s.gpsBadge}>
                <Text style={s.gpsBadgeText}>Localizacao GPS capturada</Text>
              </View>
            ) : (
              <View style={[s.gpsBadge, s.gpsBadgePending]}>
                <Text style={[s.gpsBadgeText, s.gpsBadgeTextPending]}>
                  Capturando localizacao...
                </Text>
              </View>
            )}

            {/* Result grid */}
            <Text style={s.fieldLabel}>Selecione o resultado</Text>
            <View style={s.resultGrid}>
              {RESULT_OPTIONS.map((option) => {
                const active = selectedResult === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setSelectedResult(option.value)}
                    style={[
                      s.resultButton,
                      { borderColor: active ? option.color : '#cbd5e1', backgroundColor: active ? option.bg : '#ffffff' },
                    ]}
                  >
                    <Text style={[s.resultButtonText, { color: active ? option.color : '#475569' }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payment fields (paid / partial_paid only) */}
            {selectedOption?.needsPayment ? (
              <>
                <FormField
                  label="Valor recebido (R$)"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  placeholder="150.75"
                />
                <Text style={s.fieldLabel}>Forma de pagamento</Text>
                <View style={s.methodGrid}>
                  {PAYMENT_METHODS.map((method) => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={[
                        s.methodButton,
                        paymentMethod === method && s.methodButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.methodText,
                          paymentMethod === method && s.methodTextActive,
                        ]}
                      >
                        {PAYMENT_LABELS[method]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            {/* Notes */}
            <FormField
              label="Observacao (opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="Descreva o que aconteceu..."
            />

            {/* Photo */}
            <Text style={s.fieldLabel}>Foto de comprovante (opcional)</Text>
            {photoUri ? (
              <View style={s.photoContainer}>
                <Image source={{ uri: photoUri }} style={s.photoPreview} />
                <AppButton
                  label="Remover foto"
                  variant="ghost"
                  compact
                  onPress={() => setPhotoUri(null)}
                />
              </View>
            ) : (
              <AppButton
                label="Tirar foto"
                variant="ghost"
                onPress={handleTakePhoto}
              />
            )}

            {error ? <Text style={s.error}>{error}</Text> : null}

            {/* Actions */}
            <View style={s.formActions}>
              <AppButton
                label="Cancelar"
                variant="ghost"
                onPress={() => { setFormOpen(false); setError(null); }}
              />
              <AppButton
                label="Confirmar resultado"
                loading={actionLoading}
                disabled={!selectedResult}
                onPress={handleConfirm}
              />
            </View>
          </View>
        ) : null}

        {error && !formOpen ? <Text style={s.error}>{error}</Text> : null}

      </ScrollView>
    </Screen>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    assigned:    { bg: '#e0f2fe', text: '#0369a1' },
    in_progress: { bg: '#fef3c7', text: '#92400e' },
    completed:   { bg: '#dcfce7', text: '#166534' },
    failed:      { bg: '#fee2e2', text: '#991b1b' },
    canceled:    { bg: '#f1f5f9', text: '#475569' },
    pending:     { bg: '#f1f5f9', text: '#475569' },
  };
  const colors = colorMap[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Text style={[s.badgeText, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.infoList}>{children}</View>
    </View>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{String(value)}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },

  // Cards
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#ffffff',
    padding: 16,
  },
  formCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 14,
  },
  doneCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe3ea',
    backgroundColor: '#f8fafc',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },

  // Header
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: '#0f172a', fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 8, color: '#334155', fontSize: 16, fontWeight: '700' },
  bodyText: { marginTop: 8, color: '#475569', fontSize: 14, lineHeight: 20 },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },

  // Section
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  infoList: { gap: 10 },
  infoRow: { gap: 3 },
  infoLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { color: '#0f172a', fontSize: 15, lineHeight: 21 },

  // Done
  doneText: { color: '#475569', fontSize: 15, textAlign: 'center' },

  // Form
  formTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  fieldLabel: { color: '#334155', fontSize: 13, fontWeight: '700' },

  // GPS
  gpsBadge: {
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  gpsBadgePending: { backgroundColor: '#fafafa', borderColor: '#e2e8f0' },
  gpsBadgeText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  gpsBadgeTextPending: { color: '#94a3b8' },

  // Result grid
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultButton: {
    width: '47%',
    borderRadius: 8,
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  resultButtonText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  // Payment method
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodButtonActive: { borderColor: '#0f766e', backgroundColor: '#0f766e' },
  methodText: { color: '#334155', fontWeight: '700' },
  methodTextActive: { color: '#ffffff' },

  // Photo
  photoContainer: { gap: 8 },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    resizeMode: 'cover',
    backgroundColor: '#f1f5f9',
  },

  // Form actions
  formActions: { gap: 8 },

  // Error / message
  error: {
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: 10,
    fontWeight: '700',
  },
  messageBox: { gap: 12, borderRadius: 8, backgroundColor: '#ffffff', padding: 16 },
  messageText: { color: '#334155', fontSize: 15, lineHeight: 22 },
});
