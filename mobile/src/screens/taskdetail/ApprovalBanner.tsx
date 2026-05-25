import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { a11yButton } from '../../components/a11y';
import { APPROVAL_COLOR } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import type { Task, ApprovalStatus } from '../../api/types';
import { s } from './styles';

interface Props {
  task:     Task;
  userRole: string;
  userId:   string;
  onAction: (action: 'request' | 'approve' | 'reject' | 'client' | 'client_approve' | 'client_reject') => void;
}

export function ApprovalBanner({ task, userRole, userId, onAction }: Props) {
  const { t } = useTheme();
  const status    = task.approval_status;
  const canReview = userRole === 'admin' || userRole === 'owner';
  const isClient  = userRole === 'client';

  if (!status) {
    if (task.created_by_user_id === userId || task.assignee_user_ids?.includes(userId) || canReview) {
      return (
        <TouchableOpacity
          onPress={() => onAction('request')}
          style={[s.approvalRow, { backgroundColor: t.surfaceLow, borderColor: t.outline }]}
          {...a11yButton('Request approval')}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={t.ink3} accessibilityElementsHidden />
          <Text style={[s.approvalLabel, { color: t.ink3 }]}>Request approval</Text>
          <Ionicons name="chevron-forward" size={14} color={t.ink3} accessibilityElementsHidden />
        </TouchableOpacity>
      );
    }
    return null;
  }

  const color = APPROVAL_COLOR[status] ?? '#636366';
  const labels: Record<NonNullable<ApprovalStatus>, string> = {
    pending:        'Awaiting internal review',
    pending_client: 'Awaiting client approval',
    approved:       'Approved',
    rejected:       'Rejected',
  };

  return (
    <View style={[s.approvalBanner, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <View style={s.approvalBannerRow}>
        <Ionicons name="shield-checkmark" size={16} color={color} />
        <Text style={[s.approvalBannerLabel, { color }]}>{labels[status]}</Text>
      </View>
      {task.approval_notes ? (
        <Text style={[s.approvalNotes, { color: t.ink3 }]}>{task.approval_notes}</Text>
      ) : null}

      {/* Internal review actions — owner/admin */}
      {status === 'pending' && canReview && (
        <View style={s.approvalActions}>
          <TouchableOpacity
            onPress={() => onAction('approve')}
            style={[s.approvalBtn, { backgroundColor: '#16a34a22', borderColor: '#16a34a' }]}
            {...a11yButton('Approve task')}
          >
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" accessibilityElementsHidden />
            <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700' }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAction('reject')}
            style={[s.approvalBtn, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}
            {...a11yButton('Reject task')}
          >
            <Ionicons name="close-circle" size={14} color="#ef4444" accessibilityElementsHidden />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAction('client')}
            style={[s.approvalBtn, { backgroundColor: '#7c3aed22', borderColor: '#7c3aed' }]}
            {...a11yButton('Send to client for approval')}
          >
            <Ionicons name="send" size={13} color="#7c3aed" accessibilityElementsHidden />
            <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '700' }}>Send to client</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Client approval actions */}
      {status === 'pending_client' && isClient && (
        <View style={s.approvalActions}>
          <TouchableOpacity
            onPress={() => onAction('client_approve')}
            style={[s.approvalBtn, { backgroundColor: '#16a34a22', borderColor: '#16a34a' }]}
            {...a11yButton('Approve this task')}
          >
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" accessibilityElementsHidden />
            <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700' }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAction('client_reject')}
            style={[s.approvalBtn, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}
            {...a11yButton('Request changes')}
          >
            <Ionicons name="close-circle" size={14} color="#ef4444" accessibilityElementsHidden />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Request changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
