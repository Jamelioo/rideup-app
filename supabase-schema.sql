-- RideUp Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- Drivers table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_color TEXT,
  vehicle_seats INTEGER DEFAULT 4,
  license_plate TEXT,
  license_number TEXT,
  vehicle_type TEXT DEFAULT 'standard',
  approved BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auth_user_id)
);

-- Riders table
CREATE TABLE IF NOT EXISTS public.riders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auth_user_id)
);

-- Rides table
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID REFERENCES public.riders(id),
  driver_id UUID REFERENCES public.drivers(id),
  status TEXT DEFAULT 'requested',
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_address TEXT,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  vehicle_type TEXT DEFAULT 'standard',
  fare_cents INTEGER,
  distance_miles NUMERIC(6,2),
  duration_minutes NUMERIC(6,2),
  rider_rating INTEGER,
  rider_feedback TEXT,
  rider_compliments TEXT[],
  driver_rating INTEGER,
  driver_feedback TEXT,
  promo_code TEXT,
  promo_discount_cents INTEGER DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  cancel_fee_cents INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scheduled rides
CREATE TABLE IF NOT EXISTS public.scheduled_rides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID REFERENCES auth.users(id),
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_address TEXT,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  vehicle_type TEXT DEFAULT 'standard',
  fare_cents INTEGER,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ride messages (in-app chat)
CREATE TABLE IF NOT EXISTS public.ride_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Safety reports
CREATE TABLE IF NOT EXISTS public.safety_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID,
  reporter_id UUID REFERENCES auth.users(id),
  category TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  subject TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Drivers
CREATE POLICY "Users can read own driver profile" ON public.drivers FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own driver profile" ON public.drivers FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own driver profile" ON public.drivers FOR UPDATE USING (auth.uid() = auth_user_id);

-- RLS Policies: Riders
CREATE POLICY "Users can read own rider profile" ON public.riders FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own rider profile" ON public.riders FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own rider profile" ON public.riders FOR UPDATE USING (auth.uid() = auth_user_id);

-- RLS Policies: Rides (riders and drivers can see their own rides)
CREATE POLICY "Riders can read own rides" ON public.rides FOR SELECT USING (
  rider_id IN (SELECT id FROM public.riders WHERE auth_user_id = auth.uid())
  OR driver_id IN (SELECT id FROM public.drivers WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Riders can insert rides" ON public.rides FOR INSERT WITH CHECK (
  rider_id IN (SELECT id FROM public.riders WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Ride participants can update rides" ON public.rides FOR UPDATE USING (
  rider_id IN (SELECT id FROM public.riders WHERE auth_user_id = auth.uid())
  OR driver_id IN (SELECT id FROM public.drivers WHERE auth_user_id = auth.uid())
);

-- RLS Policies: Scheduled rides
CREATE POLICY "Users can manage own scheduled rides" ON public.scheduled_rides FOR ALL USING (auth.uid() = rider_id);

-- RLS Policies: Messages
CREATE POLICY "Ride participants can read messages" ON public.ride_messages FOR SELECT USING (auth.uid() = sender_id OR true);
CREATE POLICY "Users can send messages" ON public.ride_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- RLS Policies: Safety reports
CREATE POLICY "Users can create safety reports" ON public.safety_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can read own reports" ON public.safety_reports FOR SELECT USING (auth.uid() = reporter_id);

-- RLS Policies: Support tickets
CREATE POLICY "Users can manage own tickets" ON public.support_tickets FOR ALL USING (auth.uid() = user_id);

-- Create storage bucket for avatars and documents
-- (Run these separately if needed, or create via Supabase Dashboard → Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('driver-documents', 'driver-documents', false);

-- Auto-create rider profile on signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.riders (auth_user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
