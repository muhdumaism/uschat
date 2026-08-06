import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Platform } from 'react-native';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { GlassInput } from '../../components/GlassInput';
import { Button } from '../../components/Button';
import { COLORS } from '../../theme/colors';

export const OTPScreen: React.FC<any> = ({ navigation, route }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const email = route.params?.email || 'your email';

  const handleVerify = () => {
    if (code.trim().length < 4) {
      Alert.alert('Invalid Code', 'Please enter a valid verification code.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Success', 'Code verified successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VERIFY OTP</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <GlassCard style={styles.card}>
          <View style={styles.iconContainer}>
            <KeyRound size={32} color="#FFFFFF" />
          </View>
          
          <Text style={styles.title}>ENTER SECURITY CODE</Text>
          <Text style={styles.subtitle}>
            Enter the verification code sent to {email} to confirm your device registration.
          </Text>

          <GlassInput
            placeholder="0 0 0 0 0 0"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            style={styles.otpInput}
            containerStyle={styles.otpInputContainer}
          />

          <Button
            title="VERIFY IDENTITY"
            onPress={handleVerify}
            loading={loading}
            style={styles.verifyBtn}
          />
        </GlassCard>

        <TouchableOpacity onPress={() => Alert.alert('Sent', 'A new verification code has been dispatched.')} style={styles.resendBtn}>
          <Text style={styles.resendText}>RESEND CODE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#121212',
    paddingTop: Platform.OS === 'android' ? 44 : 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#121212',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
    fontWeight: '500',
  },
  otpInputContainer: {
    width: '100%',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  verifyBtn: {
    width: '100%',
  },
  resendBtn: {
    marginTop: 24,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#121212',
  },
  resendText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
