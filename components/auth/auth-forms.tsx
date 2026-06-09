'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { UsernameInput } from "@/components/ui/username-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { LoginAttemptStatus } from "@/components/login-attempt-status";
import { PasswordResetForm } from "@/components/password-reset-form";
import { RegistrationSuccessPopup } from "@/components/registration-success-popup";
import { registrationOTPService } from "@/lib/registration-otp-service";
import { registrationNotificationService } from "@/lib/registration-notification-service";
import { AlertCircle, RefreshCw, Clock } from "lucide-react";

interface AuthFormsProps {
  onFormTypeChange: (isLogin: boolean) => void;
}

export function AuthForms({ onFormTypeChange }: AuthFormsProps) {
  // States
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"maker" | "checker">("maker");
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [showRegistrationOTP, setShowRegistrationOTP] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState({
    canResend: false,
    cooldownRemaining: 0,
    blockedUntil: 0,
    remainingAttempts: 0
  });
  
  const { toast } = useToast();
  const router = useRouter();
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        // Call the login function from auth context
        const userData = await login(username, email, password);

        // Show success toast with username and role
        toast({
          title: "Welcome to Dashboard!",
          description: `Logged in as ${userData.username} (${userData.role?.toUpperCase()})`,
          variant: "default",
          className: "bg-green-100 border-green-500 text-green-700"
        });
      } else {
        // Register - Send OTP first
        if (!showRegistrationOTP) {
          // Send OTP for registration
          const otpResult = await registrationOTPService.sendRegistrationOTP(email, username);
          
          if (otpResult.success) {
            setOtpId(otpResult.otpId!);
            setShowRegistrationOTP(true);
            toast({
              title: "OTP Sent",
              description: "Please check your email for the OTP code",
              variant: "default",
              className: "bg-blue-100 border-blue-500 text-blue-700"
            });
          } else {
            throw new Error(otpResult.message);
          }
        } else {
          // Verify OTP and complete registration
          if (!otpId) {
            throw new Error("OTP session not found. Please try again.");
          }

          const otpResult = await registrationOTPService.verifyRegistrationOTP(otpId, otpCode);
          
          if (!otpResult.success) {
            throw new Error(otpResult.message);
          }

          // Complete registration
          await register(username, email, password, role);

          // Send registration notification email
          try {
            await registrationNotificationService.sendRegistrationNotification({
              to: email,
              toName: username,
              username: username,
              password: password,
              role: role,
              registrationTime: new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
              })
            });
          } catch (emailError) {
            console.error('Failed to send registration notification email:', emailError);
            // Don't throw error, registration should still succeed
          }

          // Show registration success popup
          setRegistrationData({
            username,
            email,
            role,
            password,
            registrationTime: new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZoneName: 'short'
            })
          });
          setShowRegistrationSuccess(true);
        }
      }
    } catch (error) {
      // Show specific error message from login attempt tracking
      const errorMessage = error instanceof Error ? error.message : "Please try again with valid credentials";
      toast({
        title: "Login Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // For now, just show a message that password reset is not implemented
      toast({
        title: "Password Reset",
        description: "Password reset functionality will be implemented soon. Please contact the administrator.",
        variant: "default",
        className: "bg-blue-100 border-blue-500 text-blue-700"
      });
      setIsResetPassword(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleFormTypeChange = (newIsLogin: boolean) => {
    setIsLogin(newIsLogin);
    setIsResetPassword(false);
    setShowPasswordReset(false);
    setShowRegistrationOTP(false);
    setShowRegistrationSuccess(false);
    onFormTypeChange(newIsLogin);
    setUsername("");
    setEmail("");
    setPassword("");
    setOtpCode("");
    setOtpId(null);
    setIsUsernameValid(false);
  };

  const handlePasswordReset = () => {
    setShowPasswordReset(true);
    setIsResetPassword(false);
  };

  const handleBackFromReset = () => {
    setShowPasswordReset(false);
    setIsResetPassword(false);
  };

  const handleRegistrationSuccessClose = () => {
    setShowRegistrationSuccess(false);
    setRegistrationData(null);
    // Clear all form state completely for fresh login
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("maker");
    setShowRegistrationOTP(false);
    setOtpCode("");
    setOtpId(null);
    setResendCooldown(0);
    setResendStatus({
      canResend: false,
      cooldownRemaining: 0,
      blockedUntil: 0,
      remainingAttempts: 0
    });
    setIsLogin(true);
    onFormTypeChange(true);
  };

  // Update resend status periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (showRegistrationOTP && email) {
      const updateStatus = () => {
        const status = registrationOTPService.getResendStatus(email);
        setResendStatus(status);
        setResendCooldown(status.cooldownRemaining);
      };
      
      updateStatus(); // Initial update
      interval = setInterval(updateStatus, 1000); // Update every second
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showRegistrationOTP, email]);

  const handleResendOTP = async () => {
    if (!email || !resendStatus.canResend) return;
    
    try {
      const otpResult = await registrationOTPService.resendRegistrationOTP(email, username);
      
      if (otpResult.success) {
        setOtpId(otpResult.otpId!);
        toast({
          title: "OTP Resent",
          description: "A new OTP has been sent to your email",
          variant: "default",
          className: "bg-blue-100 border-blue-500 text-blue-700"
        });
        
        // Reset cooldown
        setResendCooldown(60);
      } else {
        toast({
          title: "Error",
          description: otpResult.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend OTP",
        variant: "destructive"
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show password reset form
  if (showPasswordReset) {
    return (
      <div className="relative">
        <PasswordResetForm 
          onBackToLogin={handleBackFromReset}
          className="w-[400px]"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto px-4">
      <Card className="w-full border-2 border-orange-500 bg-white/95 shadow-lg backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-orange-600">
            {isResetPassword ? "Reset Password" : isLogin ? "Login" : "Register"}
          </CardTitle>
          <CardDescription className="text-green-500">
            {isResetPassword
              ? "Enter your email to reset password"
              : isLogin
              ? "Enter your credentials to login"
              : "Create a new account with your details"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={isResetPassword ? handleResetPassword : handleSubmit}>
          <CardContent className="space-y-4">
            {isLogin && !isResetPassword && username && (
              <LoginAttemptStatus 
                username={username}
                onStatusChange={(isBlocked, remainingAttempts) => {
                  // You can add additional logic here if needed
                }}
              />
            )}
            {!isResetPassword && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-orange-600">Username</Label>
                <UsernameInput
                  value={username}
                  onChange={setUsername}
                  onValidationChange={setIsUsernameValid}
                  placeholder="Enter your username "
                  showValidation={!isLogin}
                  className="border-orange-500 focus:ring-orange-500 focus:border-orange-500 text-orange-600 placeholder:text-green-500"
                />
              </div>
            )}

            {(!isLogin || isResetPassword) && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-orange-600">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-orange-500 focus:ring-orange-500 focus:border-orange-500 text-orange-600 placeholder:text-green-500"
                />
              </div>
            )}

            {!isResetPassword && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-orange-600">Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-orange-500 focus:ring-orange-500 focus:border-orange-500 text-orange-600 placeholder:text-green-500"
                  showValidation={true}
                />
              </div>
            )}

            {/* OTP Verification Step for Registration */}
            {showRegistrationOTP && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Verify Your Email</h3>
                  <p className="text-blue-600 text-sm">
                    Enter the 6-digit OTP sent to <strong>{email}</strong>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-blue-600">OTP Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    className="border-blue-500 focus:ring-blue-500 focus:border-blue-500 text-blue-600 placeholder:text-blue-400 text-center text-2xl tracking-widest"
                  />
                </div>
                
                {/* Resend OTP Section */}
                <div className="text-center space-y-2">
                  {resendStatus.blockedUntil > 0 ? (
                    <div className="text-red-500 text-sm">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Too many attempts. Try again in {formatTime(Math.ceil((resendStatus.blockedUntil - Date.now()) / 1000))}
                    </div>
                  ) : resendStatus.canResend ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResendOTP}
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend OTP ({resendStatus.remainingAttempts} left)
                    </Button>
                  ) : (
                    <div className="text-gray-500 text-sm">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Resend available in {resendCooldown}s ({resendStatus.remainingAttempts} left)
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isLogin && !isResetPassword && (
              <div className="space-y-2">
                <Label className="text-orange-600">Role</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="maker"
                      value="maker"
                      checked={role === "maker"}
                      onChange={(e) => setRole(e.target.value as "maker" | "checker")}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <Label htmlFor="maker" className="text-green-600 text-sm">Maker</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="checker"
                      value="checker"
                      checked={role === "checker"}
                      onChange={(e) => setRole(e.target.value as "maker" | "checker")}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <Label htmlFor="checker" className="text-green-600 text-sm">Checker</Label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!isLogin && !isUsernameValid && !showRegistrationOTP}
            >
              {isResetPassword ? "Reset Password" : 
               isLogin ? "Login" : 
               showRegistrationOTP ? "Verify OTP & Register" : 
               "Send OTP & Register"}
            </Button>

            {isLogin && !isResetPassword && (
              <Button
                type="button"
                variant="link"
                className="text-green-600 hover:text-green-700"
                onClick={handlePasswordReset}
              >
                Forgot Password?
              </Button>
            )}

            {!isResetPassword && (
              <Button
                type="button"
                variant="link"
                className="text-green-600 hover:text-green-700"
                onClick={() => handleFormTypeChange(!isLogin)}
              >
                {isLogin ? "Need an account? Register" : "Already have an account? Login"}
              </Button>
            )}

            {isResetPassword && (
              <Button
                type="button"
                variant="link"
                className="text-green-600 hover:text-green-700"
                onClick={() => setIsResetPassword(false)}
              >
                Back to Login
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      {/* Registration Success Popup */}
      {registrationData && (
        <RegistrationSuccessPopup
          isOpen={showRegistrationSuccess}
          onClose={handleRegistrationSuccessClose}
          username={registrationData.username}
          email={registrationData.email}
          role={registrationData.role}
          password={registrationData.password}
          registrationTime={registrationData.registrationTime}
        />
      )}
    </div>
  );
}
