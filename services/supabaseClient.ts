
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zjjqclfmrxxfkynfmtha.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqanFjbGZtcnh4Zmt5bmZtdGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjI1NjcsImV4cCI6MjA4ODIzODU2N30.KL22O1-mvMWcdmnA74jTVSyxEcdgvBkG3PELsUWJSIo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
