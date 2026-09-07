"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  donorCreateSchema,
  patientCreateSchema,
  hospitalCreateSchema,
  hospitalUpdateSchema,
  BLOOD_GROUPS,
  LANGUAGES,
} from "@/lib/registry-config";
import { FormInput, FormSelect, FormError } from "./form-fields";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export function DonorCreateForm({ onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ resolver: zodResolver(donorCreateSchema) });

  async function submit(data) {
    try {
      await onSubmit(data);
    } catch (err) {
      setError("root", { message: err.message || "Could not create donor" });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError error={errors.root?.message} />
      <FormInput id="firstName" label="Name" error={errors.firstName?.message} {...register("firstName")} />
      <FormInput id="phone" label="Phone" error={errors.phone?.message} {...register("phone")} />
      <FormSelect
        id="bloodGroup"
        label="Blood Group"
        error={errors.bloodGroup?.message}
        options={[{ value: "", label: "Select blood group" }, ...BLOOD_GROUPS]}
        {...register("bloodGroup")}
      />
      <FormInput id="city" label="City" error={errors.city?.message} {...register("city")} />
      <div className="grid grid-cols-2 gap-4">
        <FormInput id="lat" label="Latitude" type="number" step="any" error={errors.lat?.message} {...register("lat")} />
        <FormInput id="lon" label="Longitude" type="number" step="any" error={errors.lon?.message} {...register("lon")} />
      </div>
      <FormSelect
        id="language"
        label="Language"
        error={errors.language?.message}
        options={LANGUAGES}
        {...register("language")}
      />
      <FormInput
        id="lastDonationAt"
        label="Last Donation (optional)"
        type="date"
        error={errors.lastDonationAt?.message}
        {...register("lastDonationAt")}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Donor
        </Button>
      </div>
    </form>
  );
}

export function PatientCreateForm({ onSubmit, onCancel }) {
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/hospitals/public")
      .then(({ body }) => {
        if (!cancelled) setHospitals(body.hospitals || []);
      })
      .catch(() => {
        if (!cancelled) setHospitals([]);
      })
      .finally(() => {
        if (!cancelled) setHospitalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ resolver: zodResolver(patientCreateSchema) });

  async function submit(data) {
    try {
      await onSubmit(data);
    } catch (err) {
      setError("root", { message: err.message || "Could not create patient" });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError error={errors.root?.message} />
      <FormInput id="firstName" label="Name" error={errors.firstName?.message} {...register("firstName")} />
      <FormInput
        id="guardianPhone"
        label="Guardian Phone"
        error={errors.guardianPhone?.message}
        {...register("guardianPhone")}
      />
      <FormSelect
        id="bloodGroup"
        label="Blood Group"
        error={errors.bloodGroup?.message}
        options={[{ value: "", label: "Select blood group" }, ...BLOOD_GROUPS]}
        {...register("bloodGroup")}
      />
      <FormSelect
        id="homeHospitalId"
        label="Home Hospital"
        error={errors.homeHospitalId?.message}
        disabled={hospitalsLoading}
        options={[
          { value: "", label: hospitalsLoading ? "Loading hospitals..." : "Select hospital" },
          ...hospitals.map((h) => ({ value: h.id, label: h.name })),
        ]}
        {...register("homeHospitalId")}
      />
      <FormInput
        id="intervalDaysEstimate"
        label="Interval Days Estimate"
        type="number"
        error={errors.intervalDaysEstimate?.message}
        {...register("intervalDaysEstimate")}
      />
      <FormInput
        id="lastTransfusionAt"
        label="Last Transfusion (optional)"
        type="date"
        error={errors.lastTransfusionAt?.message}
        {...register("lastTransfusionAt")}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Patient
        </Button>
      </div>
    </form>
  );
}

export function HospitalCreateForm({ onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ resolver: zodResolver(hospitalCreateSchema) });

  async function submit(data) {
    try {
      await onSubmit(data);
    } catch (err) {
      setError("root", { message: err.message || "Could not create hospital" });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError error={errors.root?.message} />
      <FormInput id="name" label="Name" error={errors.name?.message} {...register("name")} />
      <FormInput id="city" label="City" error={errors.city?.message} {...register("city")} />
      <div className="grid grid-cols-2 gap-4">
        <FormInput id="lat" label="Latitude" type="number" step="any" error={errors.lat?.message} {...register("lat")} />
        <FormInput id="lon" label="Longitude" type="number" step="any" error={errors.lon?.message} {...register("lon")} />
      </div>
      <FormInput
        id="deskInfo"
        label="Desk Info"
        error={errors.deskInfo?.message}
        {...register("deskInfo")}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Hospital
        </Button>
      </div>
    </form>
  );
}

export function HospitalEditForm({ item, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(hospitalUpdateSchema),
    defaultValues: {
      name: item.name,
      city: item.city,
      lat: item.lat,
      lon: item.lon,
      deskInfo: item.deskInfo,
    },
  });

  async function submit(data) {
    const body = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ""));
    try {
      await onSubmit(body);
    } catch (err) {
      setError("root", { message: err.message || "Could not update hospital" });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError error={errors.root?.message} />
      <FormInput id="edit-name" label="Name" error={errors.name?.message} {...register("name")} />
      <FormInput id="edit-city" label="City" error={errors.city?.message} {...register("city")} />
      <div className="grid grid-cols-2 gap-4">
        <FormInput id="edit-lat" label="Latitude" type="number" step="any" error={errors.lat?.message} {...register("lat")} />
        <FormInput id="edit-lon" label="Longitude" type="number" step="any" error={errors.lon?.message} {...register("lon")} />
      </div>
      <FormInput id="edit-deskInfo" label="Desk Info" error={errors.deskInfo?.message} {...register("deskInfo")} />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
