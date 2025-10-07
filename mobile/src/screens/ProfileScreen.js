import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthService';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: logout },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Editar Perfil',
      subtitle: 'Altere seus dados pessoais',
      onPress: () => Alert.alert('Em desenvolvimento', 'Funcionalidade em breve!'),
    },
    {
      icon: 'card-outline',
      title: 'Minha Assinatura',
      subtitle: 'Gerencie seu plano de sócio',
      onPress: () => navigation.navigate('Cartão'),
    },
    {
      icon: 'heart-outline',
      title: 'Minhas Doações',
      subtitle: 'Histórico de contribuições',
      onPress: () => Alert.alert('Em desenvolvimento', 'Funcionalidade em breve!'),
    },
    {
      icon: 'paw-outline',
      title: 'Minhas Adoções',
      subtitle: 'Acompanhe suas solicitações',
      onPress: () => Alert.alert('Em desenvolvimento', 'Funcionalidade em breve!'),
    },
    {
      icon: 'calendar-outline',
      title: 'Meus Eventos',
      subtitle: 'Eventos que você participou',
      onPress: () => Alert.alert('Em desenvolvimento', 'Funcionalidade em breve!'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notificações',
      subtitle: 'Ver todas as notificações',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      icon: 'help-circle-outline',
      title: 'Ajuda & Suporte',
      subtitle: 'Tire suas dúvidas',
      onPress: () => Alert.alert('Em desenvolvimento', 'Funcionalidade em breve!'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacidade',
      subtitle: 'Termos de uso e privacidade',
      onPress: () => Alert.alert('Em desenvolvimento', 'Funcionalidade em breve!'),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header com Gradient */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#FFFFFF" />
            </View>
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'Visitante'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'Entre para acessar todos os recursos'}</Text>
          {user?.role === 'MEMBER' && (
            <View style={styles.memberBadge}>
              <Ionicons name="star" size={12} color="#FFFFFF" />
              <Text style={styles.memberBadgeText}>Membro Ativo</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      {user && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="heart" size={24} color="#EC4899" />
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Doações</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="paw" size={24} color="#8B5CF6" />
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Adoções</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color="#10B981" />
            <Text style={styles.statValue}>24h</Text>
            <Text style={styles.statLabel}>Voluntário</Text>
          </View>
        </View>
      )}

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurações</Text>

        {/* Notifications Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="notifications" size={20} color="#F59E0B" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Notificações Push</Text>
              <Text style={styles.settingSubtitle}>Receber alertas no app</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }}
            thumbColor={notificationsEnabled ? '#8B5CF6' : '#F3F4F6'}
          />
        </View>

        {/* Location Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingItemLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="location" size={20} color="#3B82F6" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Localização</Text>
              <Text style={styles.settingSubtitle}>Parceiros próximos</Text>
            </View>
          </View>
          <Switch
            value={locationEnabled}
            onValueChange={setLocationEnabled}
            trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }}
            thumbColor={locationEnabled ? '#8B5CF6' : '#F3F4F6'}
          />
        </View>
      </View>

      {/* Menu Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minha Conta</Text>
        
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={22} color="#8B5CF6" />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      {user && (
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Sair da Conta</Text>
        </TouchableOpacity>
      )}

      {/* Login Button (se não estiver logado) */}
      {!user && (
        <TouchableOpacity
          style={styles.loginPrompt}
          onPress={() => navigation.navigate('Auth')}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.loginPromptGradient}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.loginPromptText}>Fazer Login / Cadastrar</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Version */}
      <Text style={styles.version}>Versão 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  memberBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: -30,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 8,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  loginPrompt: {
    marginHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  loginPromptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loginPromptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 32,
  },
});

