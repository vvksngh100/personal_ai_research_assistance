import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { 
  Lock, 
  Mail, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft, 
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose, defaultMode = 'signin' }) {
  // mode: 'signin' | 'signup' | 'forgot_request' | 'forgot_verify' | 'forgot_reset'
  const [mode, setMode] = useState(defaultMode);
  const { login, register } = useAuth();

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Reset form, errors, and mode whenever modal opens or defaultMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setError(null);
      setSuccessMsg(null);
      setResetToken(null);
      setOtp('');
      setNewPassword('');
      setShowPassword(false);
      setFormData({
        name: '',
        username: '',
        email: '',
        password: ''
      });
    }
  }, [isOpen, defaultMode]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: ''
  });
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const switchMode = (newMode) => {
    setError(null);
    setSuccessMsg(null);
    setShowPassword(false);
    setMode(newMode);
  };

  // 1. Submit Sign In or Sign Up
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await login({ email: formData.email, password: formData.password });
      } else {
        await register(formData);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Forgot Password - Step 1: Request OTP
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await authService.forgotPassword(formData.email);
      setSuccessMsg(res.message || 'If an account exists with this email, a 6-digit code has been sent.');
      setMode('forgot_verify');
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Forgot Password - Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the valid 6-digit verification code.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await authService.verifyOtp({ email: formData.email, otp: otp.trim() });
      if (!res.token) {
        throw new Error('Verification failed. No reset token received.');
      }
      setResetToken(res.token);
      setSuccessMsg('Code verified! Please set your new password.');
      setMode('forgot_reset');
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Submit Forgot Password - Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await authService.resetPassword({ resetToken, newPassword });
      setSuccessMsg(res.message || 'Password reset successfully! Redirecting to Sign In...');
      setTimeout(() => {
        setMode('signin');
        setSuccessMsg('Your password has been updated. Please sign in with your new password.');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Header Title & Subtitle based on active mode
  const getHeaderInfo = () => {
    switch (mode) {
      case 'signup':
        return {
          title: 'Create an Account',
          subtitle: 'Save your papers, sessions, and grounded citations permanently.'
        };
      case 'forgot_request':
        return {
          title: 'Reset Password',
          subtitle: 'Enter your registered email to receive a 6-digit verification code.'
        };
      case 'forgot_verify':
        return {
          title: 'Enter Verification Code',
          subtitle: `We sent a 6-digit code to ${formData.email || 'your email'}.`
        };
      case 'forgot_reset':
        return {
          title: 'Set New Password',
          subtitle: 'Create a new secure password for your ScholarAI account.'
        };
      case 'signin':
      default:
        return {
          title: 'Welcome Back',
          subtitle: 'Sign in to access and sync your permanent research history.'
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader
          title={header.title}
          subtitle={header.subtitle}
        />

        <ModalBody>
          {/* Error Alert */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'var(--status-failed-bg)',
              color: 'var(--status-failed-text)',
              border: '1px solid var(--status-failed-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="auth-success-banner">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: SIGN IN / SIGN UP */}
          {(mode === 'signin' || mode === 'signup') && (
            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'signup' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Full Name
                    </label>
                    <div className="search-box">
                      <User size={16} color="var(--text-muted)" />
                      <input
                        type="text"
                        className="search-input"
                        placeholder="e.g. Marie Curie"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Username
                    </label>
                    <div className="search-box">
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@</span>
                      <input
                        type="text"
                        className="search-input"
                        placeholder="username"
                        required
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      />
                    </div>
                  </div> */}
                </>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div className="search-box">
                  <Mail size={16} color="var(--text-muted)" />
                  <input
                    type="email"
                    className="search-input"
                    placeholder="name@university.edu"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                  Password
                </label>
                <div className="search-box">
                  <Lock size={16} color="var(--text-muted)" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="search-input"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="input-icon-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Forgot Password link placed below password input */}
                {mode === 'signin' && (
                  <div className="auth-forgot-row">
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => switchMode('forgot_request')}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-new-chat"
                disabled={loading}
                style={{ marginTop: '6px', padding: '12px' }}
              >
                {loading ? (
                  <Loader2 size={18} className="spin-animation" />
                ) : mode === 'signin' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="auth-link-btn"
                  style={{ fontSize: '0.85rem' }}
                >
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: FORGOT PASSWORD - STEP 1 (REQUEST OTP) */}
          {mode === 'forgot_request' && (
            <form onSubmit={handleForgotRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                  Registered Email Address
                </label>
                <div className="search-box">
                  <Mail size={16} color="var(--text-muted)" />
                  <input
                    type="email"
                    className="search-input"
                    placeholder="name@university.edu"
                    required
                    autoFocus
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-new-chat"
                disabled={loading}
                style={{ marginTop: '8px', padding: '12px' }}
              >
                {loading ? <Loader2 size={18} className="spin-animation" /> : 'Send Verification Code'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="auth-back-btn"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE 3: FORGOT PASSWORD - STEP 2 (VERIFY OTP) */}
          {mode === 'forgot_verify' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="otp-input-container">
                <input
                  type="text"
                  maxLength={6}
                  className="otp-input"
                  placeholder="------"
                  autoFocus
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <button
                type="submit"
                className="btn-new-chat"
                disabled={loading || otp.length !== 6}
                style={{ marginTop: '4px', padding: '12px' }}
              >
                {loading ? <Loader2 size={18} className="spin-animation" /> : 'Verify Code'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleForgotRequest}
                  disabled={loading}
                  className="auth-link-btn"
                >
                  Resend Code
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="auth-back-btn"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE 4: FORGOT PASSWORD - STEP 3 (NEW PASSWORD) */}
          {mode === 'forgot_reset' && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                  New Password
                </label>
                <div className="search-box">
                  <KeyRound size={16} color="var(--text-muted)" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="search-input"
                    placeholder="Enter at least 6 characters"
                    required
                    autoFocus
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="input-icon-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-new-chat"
                disabled={loading || newPassword.length < 6}
                style={{ marginTop: '8px', padding: '12px' }}
              >
                {loading ? <Loader2 size={18} className="spin-animation" /> : 'Update Password'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="auth-back-btn"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
