"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar, 
  Shield,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'maker' | 'checker' | 'admin';
  isVerified: boolean;
  isBlocked?: boolean;
  createdAt: string;
  lastLogin?: string;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'block' | 'unblock' | 'reject'>('approve');

  // Check if user is admin
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => {
        switch (statusFilter) {
          case 'verified': return u.isVerified && !u.isBlocked;
          case 'pending': return !u.isVerified && !u.isBlocked;
          case 'blocked': return u.isBlocked;
          default: return true;
        }
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersCollection = collection(db, 'users');
      const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(usersQuery);
      
      const usersData: User[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async () => {
    if (!selectedUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      switch (actionType) {
        case 'approve':
          await updateDoc(userRef, { isVerified: true, isBlocked: false });
          // Send approval notification
          await sendApprovalNotification(selectedUser, true);
          break;
        case 'reject':
          await updateDoc(userRef, { isVerified: false, isBlocked: true });
          // Send rejection notification
          await sendApprovalNotification(selectedUser, false);
          break;
        case 'block':
          await updateDoc(userRef, { isBlocked: true });
          break;
        case 'unblock':
          await updateDoc(userRef, { isBlocked: false });
          break;
      }

      toast({
        title: "Success",
        description: `User ${actionType}d successfully`,
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700"
      });

      // Refresh users list
      await fetchUsers();
      setShowActionDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error(`Error ${actionType}ing user:`, error);
      toast({
        title: "Error",
        description: `Failed to ${actionType} user`,
        variant: "destructive"
      });
    }
  };

  const sendApprovalNotification = async (userData: User, approved: boolean) => {
    try {
      const response = await fetch('/api/send-approval-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userData,
          approved,
          adminName: user?.username || 'Admin'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending approval notification:', error);
    }
  };

  const openActionDialog = (user: User, action: typeof actionType) => {
    setSelectedUser(user);
    setActionType(action);
    setShowActionDialog(true);
  };

  const getStatusBadge = (user: User) => {
    if (user.isBlocked) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
        <XCircle className="w-3 h-3 mr-1" />
        Blocked
      </Badge>;
    }
    if (user.isVerified) {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified
      </Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
      <Clock className="w-3 h-3 mr-1" />
      Pending
    </Badge>;
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: "bg-purple-100 text-purple-800 border-purple-300",
      checker: "bg-blue-100 text-blue-800 border-blue-300",
      maker: "bg-orange-100 text-orange-800 border-orange-300"
    };
    
    return <Badge variant="outline" className={colors[role as keyof typeof colors]}>
      <Shield className="w-3 h-3 mr-1" />
      {role.toUpperCase()}
    </Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-orange-600 flex items-center">
              <Users className="mr-3 h-8 w-8" />
              User Management
            </h1>
            <p className="text-gray-600 mt-2">Manage registered users and their access permissions</p>
          </div>
          <Button onClick={fetchUsers} variant="outline">
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-blue-600">{users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Verified</p>
                  <p className="text-2xl font-bold text-green-600">
                    {users.filter(u => u.isVerified && !u.isBlocked).length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {users.filter(u => !u.isVerified && !u.isBlocked).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Blocked</p>
                  <p className="text-2xl font-bold text-red-600">
                    {users.filter(u => u.isBlocked).length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by username or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="checker">Checker</SelectItem>
                  <SelectItem value="maker">Maker</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">User</th>
                    <th className="text-left p-4 font-semibold">Role</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Created</th>
                    <th className="text-left p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((userData) => (
                    <tr key={userData.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium">{userData.username}</p>
                            <p className="text-sm text-gray-600 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {userData.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {getRoleBadge(userData.role)}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(userData)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(userData.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!userData.isVerified && !userData.isBlocked && (
                              <DropdownMenuItem onClick={() => openActionDialog(userData, 'approve')}>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Approve User
                              </DropdownMenuItem>
                            )}
                            {!userData.isVerified && !userData.isBlocked && (
                              <DropdownMenuItem onClick={() => openActionDialog(userData, 'reject')}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject User
                              </DropdownMenuItem>
                            )}
                            {!userData.isBlocked && (
                              <DropdownMenuItem onClick={() => openActionDialog(userData, 'block')}>
                                <UserX className="w-4 h-4 mr-2" />
                                Block User
                              </DropdownMenuItem>
                            )}
                            {userData.isBlocked && (
                              <DropdownMenuItem onClick={() => openActionDialog(userData, 'unblock')}>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Unblock User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-600">No users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Confirmation Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                Confirm Action
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to {actionType} user "{selectedUser?.username}"?
                {actionType === 'approve' && " This will allow them to access the system."}
                {actionType === 'reject' && " This will deny their access request."}
                {actionType === 'block' && " This will prevent them from accessing the system."}
                {actionType === 'unblock' && " This will restore their system access."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActionDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUserAction}
                variant={actionType === 'reject' || actionType === 'block' ? 'destructive' : 'default'}
              >
                {actionType === 'approve' && 'Approve User'}
                {actionType === 'reject' && 'Reject User'}
                {actionType === 'block' && 'Block User'}
                {actionType === 'unblock' && 'Unblock User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
