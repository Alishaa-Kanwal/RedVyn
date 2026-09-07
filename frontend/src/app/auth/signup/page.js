"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MapPin, User, Building2, Droplet, Stethoscope, Mail } from "lucide-react";
import Link from "next/link";
import { useAuth, dashboardPath } from "@/components/auth-provider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RoleTabs } from "@/components/auth/role-tabs";
import { TextInput } from "@/components/auth/text-input";
import { PhoneInput } from "@/components/auth/phone-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const CITY_COORDS = {
  Lahore: { lat: 31.5204, lon: 74.3587 },
  Karachi: { lat: 24.8607, lon: 67.0011 },
  Islamabad: { lat: 33.6844, lon: 73.0479 },
  Rawalpindi: { lat: 33.5651, lon: 73.0169 },
  Faisalabad: { lat: 31.418, lon: 73.079 },
  Multan: { lat: 30.1575, lon: 71.5249 },
  Peshawar: { lat: 34.015, lon: 71.5249 },
  Quetta: { lat: 30.1798, lon: 66.975 },
};

const BLOOD_GROUPS = [
  "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG",
];

const signupSchema = z
  .discriminatedUnion("role", [
    z.object({
      role: z.literal("donor"),
      fullName: z.string().min(1, "Enter your full name."),
      phone: z.string().min(6, "Enter a valid phone number."),
      email: z.string().email("Enter a valid email address."),
      bloodGroup: z.enum(BLOOD_GROUPS),
      city: z.string().min(1, "Select your city."),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      password: z.string().min(8, "Password must be at least 8 characters."),
      confirmPassword: z.string().min(1, "Confirm your password."),
      terms: z.literal(true, {
        errorMap: () => ({ message: "You must agree to the terms." }),
      }),
    }),
    z.object({
      role: z.literal("guardian"),
      patientName: z.string().min(1, "Enter the patient's name."),
      guardianPhone: z.string().min(6, "Enter a valid phone number."),
      email: z.string().email("Enter a valid email address."),
      bloodGroup: z.enum(BLOOD_GROUPS),
      homeHospitalId: z.string().min(1, "Select a home hospital."),
      password: z.string().min(8, "Password must be at least 8 characters."),
      confirmPassword: z.string().min(1, "Confirm your password."),
      terms: z.literal(true, {
        errorMap: () => ({ message: "You must agree to the terms." }),
      }),
    }),
    z.object({
      role: z.literal("hospital"),
      hospitalName: z.string().min(1, "Enter the hospital name."),
      phone: z.string().min(6, "Enter a valid phone number."),
      email: z.string().email("Enter a valid email address."),
      city: z.string().min(1, "Select your city."),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      deskInfo: z.string().min(1, "Enter desk/blood bank info."),
      password: z.string().min(8, "Password must be at least 8 characters."),
      confirmPassword: z.string().min(1, "Confirm your password."),
      terms: z.literal(true, {
        errorMap: () => ({ message: "You must agree to the terms." }),
      }),
    }),
  ])
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function SignUpForm() {
  const { user, loading, signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const [hospitals, setHospitals] = useState([]);
  const [fetchingHospitals, setFetchingHospitals] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: ["donor", "guardian", "hospital"].includes(roleParam) ? roleParam : "donor",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const role = watch("role");

  useEffect(() => {
    if (role === "guardian") {
      setFetchingHospitals(true);
      apiFetch("/api/hospitals/public")
        .then(({ body }) => setHospitals(body.hospitals || []))
        .catch(() => toast.error("Could not load hospitals."))
        .finally(() => setFetchingHospitals(false));
    }
  }, [role]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(dashboardPath(user.role));
    }
  }, [user, loading, router]);

  function applyCityCoords(city) {
    const coords = CITY_COORDS[city];
    if (coords) {
      setValue("lat", coords.lat, { shouldValidate: true });
      setValue("lon", coords.lon, { shouldValidate: true });
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("lat", pos.coords.latitude, { shouldValidate: true });
        setValue("lon", pos.coords.longitude, { shouldValidate: true });
        toast.success("Location captured.");
      },
      () => toast.error("Could not get your location. Please select a city.")
    );
  }

  async function onSubmit(values) {
    try {
      let payload = { role: values.role, password: values.password };

      if (values.role === "donor") {
        payload = {
          ...payload,
          firstName: values.fullName,
          phone: values.phone,
          email: values.email,
          bloodGroup: values.bloodGroup,
          city: values.city,
          lat: values.lat,
          lon: values.lon,
          language: "ur",
        };
      } else if (values.role === "guardian") {
        payload = {
          ...payload,
          name: values.patientName,
          email: values.email,
          patient: {
            firstName: values.patientName,
            guardianPhone: values.guardianPhone,
            bloodGroup: values.bloodGroup,
            homeHospitalId: values.homeHospitalId,
            intervalDaysEstimate: 21,
          },
        };
      } else if (values.role === "hospital") {
        payload = {
          ...payload,
          email: values.email,
          hospital: {
            name: values.hospitalName,
            city: values.city,
            lat: values.lat,
            lon: values.lon,
            deskInfo: values.deskInfo,
          },
        };
      }

      const me = await signup(payload);
      toast.success("Account created!");
      router.replace(dashboardPath(me.role));
    } catch (err) {
      toast.error(err.message || "Could not create account. Please try again.");
    }
  }

  if (loading || user) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <RoleTabs value={role} onChange={(r) => setValue("role", r)} className="mx-auto" />

        {role === "donor" && (
          <>
            <TextInput
              label="Full Name"
              placeholder="Enter your full name"
              icon={User}
              error={errors.fullName?.message}
              {...register("fullName")}
            />
            <PhoneInput
              label="Phone Number"
              placeholder="Enter your phone number"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <TextInput label="Email Address" type="email" autoComplete="email" placeholder="Enter your email address" icon={Mail} error={errors.email?.message} {...register("email")} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Blood Group</span>
              <div
                className={`flex items-center overflow-hidden rounded-xl border bg-card transition-colors focus-within:border-primary ${
                  errors.bloodGroup ? "border-primary" : "border-border"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
                  <Droplet className="h-4 w-4" />
                </span>
                <select
                  className="h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none"
                  {...register("bloodGroup")}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g.replace("_POS", "+").replace("_NEG", "-")}
                    </option>
                  ))}
                </select>
              </div>
              {errors.bloodGroup && (
                <span className="text-xs font-medium text-primary">{errors.bloodGroup.message}</span>
              )}
            </label>
            <CityField register={register} errors={errors} onChange={applyCityCoords} />
            <LocationHint lat={watch("lat")} lon={watch("lon")} onLocate={useMyLocation} />
          </>
        )}

        {role === "guardian" && (
          <>
            <TextInput
              label="Patient Name"
              placeholder="Enter patient's name"
              icon={User}
              error={errors.patientName?.message}
              {...register("patientName")}
            />
            <PhoneInput
              label="Guardian Phone Number"
              placeholder="Enter guardian phone number"
              error={errors.guardianPhone?.message}
              {...register("guardianPhone")}
            />
            <TextInput label="Email Address" type="email" autoComplete="email" placeholder="Enter your email address" icon={Mail} error={errors.email?.message} {...register("email")} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Blood Group</span>
              <div
                className={`flex items-center overflow-hidden rounded-xl border bg-card transition-colors focus-within:border-primary ${
                  errors.bloodGroup ? "border-primary" : "border-border"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
                  <Droplet className="h-4 w-4" />
                </span>
                <select
                  className="h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none"
                  {...register("bloodGroup")}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g.replace("_POS", "+").replace("_NEG", "-")}
                    </option>
                  ))}
                </select>
              </div>
              {errors.bloodGroup && (
                <span className="text-xs font-medium text-primary">{errors.bloodGroup.message}</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Home Hospital</span>
              <div
                className={`flex items-center overflow-hidden rounded-xl border bg-card transition-colors focus-within:border-primary ${
                  errors.homeHospitalId ? "border-primary" : "border-border"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
                  <Stethoscope className="h-4 w-4" />
                </span>
                <select
                  className="h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none disabled:opacity-60"
                  disabled={fetchingHospitals}
                  {...register("homeHospitalId")}
                >
                  <option value="">{fetchingHospitals ? "Loading hospitals..." : "Select hospital"}</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}, {h.city}
                    </option>
                  ))}
                </select>
              </div>
              {errors.homeHospitalId && (
                <span className="text-xs font-medium text-primary">{errors.homeHospitalId.message}</span>
              )}
            </label>
          </>
        )}

        {role === "hospital" && (
          <>
            <TextInput
              label="Hospital Name"
              placeholder="Enter hospital name"
              icon={Building2}
              error={errors.hospitalName?.message}
              {...register("hospitalName")}
            />
            <PhoneInput
              label="Contact Phone Number"
              placeholder="Enter hospital phone number"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <TextInput label="Email Address" type="email" autoComplete="email" placeholder="Enter your email address" icon={Mail} error={errors.email?.message} {...register("email")} />
            <CityField register={register} errors={errors} onChange={applyCityCoords} />
            <LocationHint lat={watch("lat")} lon={watch("lon")} onLocate={useMyLocation} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Desk / Blood Bank Info</span>
              <textarea
                rows={3}
                placeholder="e.g. Blood bank, ground floor, gate 2"
                className={`rounded-xl border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary ${
                  errors.deskInfo ? "border-primary" : "border-border"
                }`}
                {...register("deskInfo")}
              />
              {errors.deskInfo && (
                <span className="text-xs font-medium text-primary">{errors.deskInfo.message}</span>
              )}
            </label>
          </>
        )}

        <PasswordInput
          label="Password"
          placeholder="Create a strong password"
          showStrength
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordInput
          label="Confirm Password"
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <label className="flex items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border text-primary"
            {...register("terms")}
          />
          <span>
            I agree to the{" "}
            <Link href="#" className="font-semibold text-primary hover:underline">
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link href="#" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.terms && (
          <span className="text-xs font-medium text-primary">{errors.terms.message}</span>
        )}

        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
        </Button>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/signin" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  export default function SignUpPage() {
    return (
      <AuthLayout title="Create Your Account" subtitle="Join our mission. Save lives.">
        <Suspense
          fallback={
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <SignUpForm />
        </Suspense>
      </AuthLayout>
    );
  }

  function CityField({ register, errors, onChange }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">City</span>
      <div
        className={`flex items-center overflow-hidden rounded-xl border bg-card transition-colors focus-within:border-primary ${
          errors.city ? "border-primary" : "border-border"
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
          <MapPin className="h-4 w-4" />
        </span>
        <select
          className="h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none"
          {...register("city", { onChange: (e) => onChange(e.target.value) })}
        >
          <option value="">Select city</option>
          {Object.keys(CITY_COORDS).map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      {errors.city && <span className="text-xs font-medium text-primary">{errors.city.message}</span>}
    </label>
  );
}

function LocationHint({ lat, lon, onLocate }) {
  const hasCoords = lat != null && lon != null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">
        {hasCoords
          ? `Location: ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`
          : "City center coordinates will be used."}
      </span>
      <button
        type="button"
        onClick={onLocate}
        className="text-xs font-semibold text-primary hover:underline"
      >
        Use my location
      </button>
    </div>
  );
}
