import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { getMe, changePassword } from '../services/authService';
import useAuthStore from '../store/authStore';
import usePageTitle from '../hooks/usePageTitle';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { ROLE_COLORS } from '../utils/constants';
import { formatDate } from '../utils/dateFormat';

const Profile = () => {
  usePageTitle('My Profile');
  const { user, updateProfile } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm();

  const changePwdMutation = useMutation({
    mutationFn: (data) => changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to change password'),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">My Profile</h1>

      {/* Profile Info */}
      <Card header="Personal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Full Name', value: user?.fullName },
            { label: 'Username', value: user?.username },
            { label: 'Email', value: user?.email },
            { label: 'Mobile', value: user?.mobile },
            { label: 'Role', value: <Badge color={ROLE_COLORS[user?.role] || 'gray'} className="capitalize">{user?.role?.replace('-', ' ')}</Badge> },
            { label: 'Status', value: <Badge color={user?.status === 'active' ? 'green' : 'gray'}>{user?.status}</Badge> },
            { label: 'Member Since', value: formatDate(user?.createdAt) },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">{item.label}</span>
              <span className="text-gray-800 font-medium">{item.value ?? '—'}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Change Password */}
      <Card header="Change Password">
        <form onSubmit={handleSubmit((d) => changePwdMutation.mutate(d))} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="label-base">Current Password<span className="text-danger-500 ml-0.5">*</span></label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} placeholder="Current password"
                className={`input-base pr-10 ${errors.currentPassword ? 'input-error' : ''}`}
                {...register('currentPassword', { required: 'Required' })} />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 inset-y-0 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && <p className="mt-1 text-xs text-danger-600">{errors.currentPassword.message}</p>}
          </div>

          {/* New Password */}
          <div>
            <label className="label-base">New Password<span className="text-danger-500 ml-0.5">*</span></label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} placeholder="Min 8 characters"
                className={`input-base pr-10 ${errors.newPassword ? 'input-error' : ''}`}
                {...register('newPassword', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 inset-y-0 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1 text-xs text-danger-600">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="label-base">Confirm New Password<span className="text-danger-500 ml-0.5">*</span></label>
            <input type="password" placeholder="Repeat new password"
              className={`input-base ${errors.confirmPassword ? 'input-error' : ''}`}
              {...register('confirmPassword', {
                required: 'Required',
                validate: (v) => v === watch('newPassword') || 'Passwords do not match',
              })} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-danger-600">{errors.confirmPassword.message}</p>}
          </div>

          <div className="flex justify-end">
            <Button type="submit" icon={Save} loading={changePwdMutation.isPending}>Change Password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Profile;
