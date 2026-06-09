'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { validatePassword, checkPasswordFormat } from '@/lib/password-validator';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Lock, Eye } from 'lucide-react';

export function PasswordValidationDemo() {
  const [password, setPassword] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const examplePasswords = [
    { password: 'Password123!', description: 'Perfect example - meets all requirements' },
    { password: 'password123!', description: 'Missing capital letter' },
    { password: 'PASSWORD123!', description: 'Missing lowercase letters' },
    { password: 'Password123', description: 'Missing special characters' },
    { password: 'Password!', description: 'Missing numbers' },
    { password: 'Pass1!', description: 'Too short (less than 8 characters)' },
    { password: 'A', description: 'Too short and missing requirements' }
  ];

  const handleTestPassword = () => {
    if (!testPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a password to test",
        variant: "destructive"
      });
      return;
    }

    setPassword(testPassword);
    setShowResults(true);
  };

  const handleExampleClick = (examplePassword: string) => {
    setTestPassword(examplePassword);
    setPassword(examplePassword);
    setShowResults(true);
  };

  const validation = password ? validatePassword(password) : null;
  const formatCheck = password ? checkPasswordFormat(password) : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600 flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Password Validation Demo
          </CardTitle>
          <CardDescription>
            Test the password validation system with different password examples
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-password">Test Password</Label>
            <div className="flex space-x-2">
              <Input
                id="test-password"
                placeholder="Enter a password to test"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTestPassword}>
                Test Password
              </Button>
            </div>
          </div>

          {showResults && validation && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-semibold text-gray-800 mb-3">Validation Results:</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-white">
                  <div className={`text-2xl font-bold ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {validation.isValid ? '✓' : '✗'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {validation.isValid ? 'Valid' : 'Invalid'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white">
                  <div className={`text-2xl font-bold ${formatCheck ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCheck ? '✓' : '✗'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Format Check
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Requirements:</h5>
                {Object.entries(validation.rules).map(([ruleId, rule]) => (
                  <div key={ruleId} className="flex items-center space-x-2">
                    {rule.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm ${rule.passed ? 'text-green-700' : 'text-red-700'}`}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Password Strength: {validation.strength}</span>
                </div>
                <div className="flex space-x-1">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`h-2 w-6 rounded ${
                        (validation.strength === 'weak' && level === 1) ||
                        (validation.strength === 'medium' && level <= 2) ||
                        (validation.strength === 'strong' && level <= 3)
                          ? 'bg-blue-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h4 className="font-semibold text-gray-800 mb-3">Example Passwords:</h4>
            <div className="grid gap-2">
              {examplePasswords.map((example, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleExampleClick(example.password)}
                >
                  <div>
                    <code className="text-blue-600 font-mono">{example.password}</code>
                    <p className="text-sm text-gray-600 mt-1">{example.description}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    Test
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Password Requirements Summary:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Must start with a capital letter (A-Z)</li>
              <li>• Must contain lowercase letters (a-z)</li>
              <li>• Must contain special characters (!@#$%^&*)</li>
              <li>• Must contain numbers (0-9)</li>
              <li>• Must be at least 8 characters long</li>
              <li>• Must be no more than 50 characters</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600">Live Password Input with Validation</CardTitle>
          <CardDescription>
            This is how the password input appears in the actual login/registration forms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="demo-password">Password</Label>
            <PasswordInput
              id="demo-password"
              placeholder="Enter your password (Capital + lowercase + numbers + special chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showValidation={true}
              className="border-orange-500 focus:ring-orange-500 focus:border-orange-500 text-orange-600 placeholder:text-green-500"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
