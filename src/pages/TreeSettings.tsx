import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export function TreeSettings() {
    const { treeId } = useParams<{ treeId: string }>();
    const tree = useQuery(api.trees.get, treeId ? { treeId: treeId as Id<"trees"> } : "skip");
    const members = useQuery(api.trees.getMembers, treeId ? { treeId: treeId as Id<"trees"> } : "skip");
    const invitations = useQuery(
        api.trees.getInvitations,
        treeId && tree?.role === 'admin' ? { treeId: treeId as Id<"trees"> } : "skip"
    );

    const updateTree = useMutation(api.trees.update);
    const updateMemberRole = useMutation(api.trees.updateMemberRole);
    const removeMember = useMutation(api.trees.removeMember);
    const inviteMember = useAction(api.trees.invite);
    const cancelInvitation = useAction(api.trees.cancelInvitation);

    const [name, setName] = useState(tree?.name || '');
    const [description, setDescription] = useState(tree?.description || '');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
    const [isSaving, setIsSaving] = useState(false);
    const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [removeTarget, setRemoveTarget] = useState<{ userId: Id<"users">; name: string } | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);
    const [cancelTarget, setCancelTarget] = useState<{ invitationId: Id<"invitations">; email: string } | null>(null);
    const [isCanceling, setIsCanceling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    // Update local state when tree data loads
    useEffect(() => {
        if (tree) {
            setName(tree.name);
            setDescription(tree.description || '');
        }
    }, [tree]);

    if (!tree || !members) {
        return <div className="spinner spinner-lg mx-auto mt-12" />;
    }

    const isAdmin = tree.role === 'admin';

    const handleUpdateTree = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateTree({
                treeId: tree._id,
                name,
                description,
            });
            setStatusMessage({ type: 'success', message: 'Tree updated successfully.' });
        } catch (error) {
            console.error(error);
            setStatusMessage({ type: 'error', message: 'Failed to update tree.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateRole = async (userId: Id<"users">, newRole: 'admin' | 'user') => {
        try {
            await updateMemberRole({
                treeId: tree._id,
                userId,
                role: newRole,
            });
            setStatusMessage({ type: 'success', message: 'Member role updated.' });
        } catch (error) {
            console.error(error);
            setStatusMessage({ type: 'error', message: 'Failed to update role.' });
        }
    };

    const handleRemoveMember = (userId: Id<"users">, name: string) => {
        setRemoveTarget({ userId, name });
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await inviteMember({
                treeId: tree._id,
                email: inviteEmail,
                role: inviteRole,
            });
            setInviteStatus({ type: 'success', message: `Invitation sent to ${inviteEmail}` });
            setInviteEmail('');
        } catch (error) {
            console.error(error);
            setInviteStatus({ type: 'error', message: "Failed to send invitation." });
        }
    };

    const handleConfirmRemove = async () => {
        if (!removeTarget) return;
        setIsRemoving(true);
        setRemoveError(null);
        try {
            await removeMember({
                treeId: tree._id,
                userId: removeTarget.userId,
            });
            setStatusMessage({ type: 'success', message: `Removed ${removeTarget.name} from the tree.` });
            setRemoveTarget(null);
        } catch (error) {
            console.error(error);
            setRemoveError('Failed to remove member.');
        } finally {
            setIsRemoving(false);
        }
    };

    const handleCancelInvite = (invitationId: Id<"invitations">, email: string) => {
        setCancelTarget({ invitationId, email });
    };

    const handleConfirmCancel = async () => {
        if (!cancelTarget) return;
        setIsCanceling(true);
        setCancelError(null);
        try {
            await cancelInvitation({
                treeId: tree._id,
                invitationId: cancelTarget.invitationId,
            });
            setStatusMessage({ type: 'success', message: `Canceled invitation for ${cancelTarget.email}.` });
            setCancelTarget(null);
        } catch (error) {
            console.error(error);
            setCancelError('Failed to cancel invitation.');
        } finally {
            setIsCanceling(false);
        }
    };

    const safeMembers = (members ?? []).filter(
        (member): member is {
            userId: Id<"users">;
            name: string;
            email: string;
            avatarUrl: string | undefined;
            role: 'admin' | 'user';
            joinedAt: number;
        } => Boolean(member)
    );

    return (
        <div className="container py-8">
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-muted mb-2">
                    <Link to="/" className="hover:text-accent">Trees</Link>
                    <span>/</span>
                    <Link to={`/tree/${tree._id}`} className="hover:text-accent">{tree.name}</Link>
                    <span>/</span>
                    <span>Settings</span>
                </div>
                <h1 className="text-3xl font-bold">Tree Settings</h1>
                {statusMessage && (
                    <div
                        className={`mt-4 text-sm p-3 rounded ${statusMessage.type === 'success'
                            ? 'bg-success-bg text-success'
                            : 'bg-error-bg text-error'
                        }`}
                    >
                        {statusMessage.message}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* General Settings */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="card p-6">
                        <h2 className="text-xl font-bold mb-4">General Information</h2>
                        <form onSubmit={handleUpdateTree} className="space-y-4">
                            <div className="form-group">
                                <label className="label">Tree Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={!isAdmin}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Description</label>
                                <textarea
                                    className="input min-h-[100px]"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={!isAdmin}
                                />
                            </div>
                            {isAdmin && (
                                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            )}
                        </form>
                    </section>

                    <section className="card p-6">
                        <h2 className="text-xl font-bold mb-4">Members</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-2 font-semibold">User</th>
                                        <th className="py-2 font-semibold">Role</th>
                                        {isAdmin && <th className="py-2 font-semibold text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {safeMembers.map((member) => (
                                        <tr key={member.userId} className="group">
                                            <td className="py-3">
                                                <div className="flex items-center gap-3">
                                                    {member.avatarUrl ? (
                                                        <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center text-accent font-bold">
                                                            {member.name?.[0] || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-medium">{member.name}</div>
                                                        <div className="text-xs text-muted">{member.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                {isAdmin ? (
                                                    <select
                                                        className="input py-1 px-2 text-sm w-auto"
                                                        value={member.role}
                                                        onChange={(e) => handleUpdateRole(member.userId, e.target.value as 'admin' | 'user')}
                                                        disabled={member.userId === tree.createdBy} // Cannot change owner role
                                                    >
                                                        <option value="user">Reader</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                ) : (
                                                    <span className="badge">{member.role === 'admin' ? 'Admin' : 'Reader'}</span>
                                                )}
                                            </td>
                                            {isAdmin && (
                                                <td className="py-3 text-right">
                                                    {member.userId !== tree.createdBy && (
                                                        <button
                                                            className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100"
                                                            onClick={() => handleRemoveMember(member.userId, member.name)}
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Invitations & Sidebar */}
                <div className="space-y-8">
                    {isAdmin && (
                        <section className="card p-6">
                            <h2 className="text-lg font-bold mb-4">Invite Member</h2>
                            <form onSubmit={handleInvite} className="space-y-4">
                                <div className="form-group">
                                    <label className="label">Email Address</label>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="user@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Role</label>
                                    <select
                                        className="input"
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'user')}
                                    >
                                        <option value="user">Reader (Read/Write Data)</option>
                                        <option value="admin">Admin (Full Control)</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary w-full">
                                    Send Invitation
                                </button>
                                {inviteStatus && (
                                    <div className={`text-sm p-2 rounded ${inviteStatus.type === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                                        {inviteStatus.message}
                                    </div>
                                )}
                            </form>
                        </section>
                    )}

                    <section className="card p-6">
                        <h2 className="text-lg font-bold mb-4">Pending Invitations</h2>
                        {invitations && invitations.length > 0 ? (
                            <div className="space-y-3">
                                {invitations.map((inv: Doc<"invitations">) => (
                                    <div key={inv._id} className="flex justify-between items-center text-sm p-3 bg-bg-secondary rounded-lg">
                                        <div>
                                            <div className="font-medium">{inv.email}</div>
                                            <div className="text-xs text-muted">{inv.role === 'admin' ? 'Admin' : 'Reader'}</div>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                className="btn btn-ghost btn-sm text-error"
                                                onClick={() => handleCancelInvite(inv._id, inv.email)}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted">No pending invitations.</p>
                        )}
                    </section>
                </div>
            </div>
            {removeTarget && (
                <ConfirmModal
                    title="Remove Member"
                    description={`Removing ${removeTarget.name} will revoke their access to this tree. This action cannot be undone.`}
                    confirmLabel="Remove Member"
                    busyLabel="Removing..."
                    isBusy={isRemoving}
                    errorMessage={removeError}
                    onClose={() => {
                        setRemoveTarget(null);
                        setRemoveError(null);
                    }}
                    onConfirm={handleConfirmRemove}
                />
            )}
            {cancelTarget && (
                <ConfirmModal
                    title="Cancel Invitation"
                    description={`Canceling the invitation for ${cancelTarget.email} will prevent them from joining this tree.`}
                    confirmLabel="Cancel Invitation"
                    busyLabel="Canceling..."
                    isBusy={isCanceling}
                    errorMessage={cancelError}
                    onClose={() => {
                        setCancelTarget(null);
                        setCancelError(null);
                    }}
                    onConfirm={handleConfirmCancel}
                />
            )}
        </div>
    );
}
