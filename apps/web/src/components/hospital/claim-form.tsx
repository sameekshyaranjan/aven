'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ClaimIntakeSchema,
  type ClaimIntake,
  type DraftClaim,
  type HospitalClaim,
} from '@aven/contracts';
import { Button } from '@/components/ui/button';
import { createClaim, updateClaim } from '@/lib/api';
import { readToken } from '@/lib/session';

const fields: {
  title: string;
  items: { name: keyof ClaimIntake; label: string; type?: string; options?: string[] }[];
}[] = [
  {
    title: 'Patient',
    items: [
      { name: 'patientName', label: 'Patient name' },
      { name: 'patientDateOfBirth', label: 'Date of birth', type: 'date' },
      { name: 'patientGender', label: 'Gender', options: ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'] },
      { name: 'patientContact', label: 'Contact' },
    ],
  },
  {
    title: 'Admission',
    items: [
      { name: 'admissionType', label: 'Admission type', options: ['PLANNED', 'EMERGENCY'] },
      { name: 'expectedAdmissionDate', label: 'Expected admission', type: 'date' },
      { name: 'expectedDischargeDate', label: 'Expected discharge', type: 'date' },
      { name: 'roomCategory', label: 'Room category (required for planned admission)' },
    ],
  },
  {
    title: 'Treatment and estimate',
    items: [
      { name: 'provisionalDiagnosis', label: 'Provisional diagnosis', type: 'textarea' },
      { name: 'proposedTreatment', label: 'Proposed treatment', type: 'textarea' },
      { name: 'doctorName', label: 'Treating doctor' },
      { name: 'doctorRegistrationId', label: 'Doctor registration ID' },
      { name: 'estimatedAmount', label: 'Estimated amount', type: 'number' },
    ],
  },
];

export const fieldLabel = (name: string) =>
  fields.flatMap((section) => section.items).find((item) => item.name === name)?.label ?? name;

export function ClaimForm({
  claim,
  onSaved,
}: {
  claim?: HospitalClaim;
  onSaved: (saved: DraftClaim) => void;
}) {
  const [enrollmentId, setEnrollmentId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClaimIntake>({
    resolver: zodResolver(ClaimIntakeSchema),
    defaultValues: claim?.intake ?? {},
  });

  async function save(intake: ClaimIntake) {
    const token = readToken();
    if (!token) return;
    setError('');
    try {
      const saved = claim
        ? await updateClaim(token, claim.id, claim.version, intake)
        : await createClaim(token, { enrollmentId, memberId, intake });
      reset(saved.intake);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save draft.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(save)}
      className="space-y-6 rounded-xl border border-border bg-card p-5"
    >
      {!claim && (
        <section className="space-y-3">
          <h2 className="font-semibold">Member from the synthetic policy copy</h2>
          <p className="text-sm text-muted-foreground">
            Enter the enrollment and member IDs. No policy terms are shown here.
          </p>
          <label className="block text-sm">
            Enrollment ID
            <input
              required
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
          <label className="block text-sm">
            Member ID
            <input
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => {
              setEnrollmentId('d1000000-0000-4000-8000-000000000001');
              setMemberId('d2000000-0000-4000-8000-000000000001');
            }}
          >
            Use fictional demo member
          </button>
        </section>
      )}
      {fields.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="font-semibold">{section.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items
              .filter(
                (field) => field.name !== 'roomCategory' || watch('admissionType') === 'PLANNED',
              )
              .map((field) => {
                const binding = register(field.name, {
                  setValueAs: (value: string) =>
                    field.type === 'number'
                      ? value === ''
                        ? undefined
                        : Number(value)
                      : value === ''
                        ? undefined
                        : value,
                });
                return (
                  <label key={field.name} className="block text-sm">
                    {field.label}
                    {field.options ? (
                      <select {...binding} className="mt-1 block w-full rounded border p-2">
                        <option value="">Choose</option>
                        {field.options.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        {...binding}
                        rows={3}
                        className="mt-1 block w-full rounded border p-2"
                      />
                    ) : (
                      <input
                        {...binding}
                        type={field.type ?? 'text'}
                        min={field.type === 'number' ? 0 : undefined}
                        className="mt-1 block w-full rounded border p-2"
                      />
                    )}
                    {errors[field.name] && (
                      <span className="block text-red-700">{errors[field.name]?.message}</span>
                    )}
                  </label>
                );
              })}
          </div>
          {section.title === 'Treatment and estimate' && (
            <p className="text-sm text-muted-foreground">
              You may also upload a written estimate. Enter its amount here before normal
              submission.
            </p>
          )}
        </section>
      ))}
      <div className="space-y-2 text-sm">
        <label className="flex gap-2">
          <input type="checkbox" {...register('attestationConfirmed')} /> Hospital attestation
          confirmed
        </label>
        <label className="flex gap-2">
          <input type="checkbox" {...register('consentConfirmed')} /> Patient consent confirmed
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save draft'}
      </Button>
    </form>
  );
}
