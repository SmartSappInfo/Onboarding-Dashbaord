'use client';

import * as React from 'react';
import { CountrySelect } from './CountrySelect';
import { RegionSelect } from './RegionSelect';
import { DistrictSelect } from './DistrictSelect';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface LocationValue {
  country?: { id: string; name: string; code: string; flag: string } | null;
  region?: { id: string; name: string } | null;
  district?: { id: string; name: string } | null;
}

interface LocationCascadeProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  defaultCountryId?: string;
  disabled?: boolean;
}

/**
 * Cascading location selector: Country → Region → District.
 * Changing a parent level clears all child levels.
 */
export function LocationCascade({
  value,
  onChange,
  defaultCountryId,
  disabled,
}: LocationCascadeProps) {
  return (
    <div className="space-y-3">
      {/* Country */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Country</Label>
          {value.country && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-md text-muted-foreground hover:text-destructive"
              onClick={() => onChange({ country: null, region: null, district: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <CountrySelect
          value={value.country}
          onValueChange={(country) => {
            // Clear children when country changes
            onChange({ country, region: null, district: null });
          }}
          defaultCountryId={defaultCountryId}
          disabled={disabled}
        />
      </div>

      {/* Region */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Region</Label>
          {value.region && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-md text-muted-foreground hover:text-destructive"
              onClick={() => onChange({ ...value, region: null, district: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <RegionSelect
          value={value.region}
          onValueChange={(region) => {
            // Clear district when region changes
            onChange({ ...value, region, district: null });
          }}
          countryId={value.country?.id}
          disabled={disabled || !value.country}
        />
      </div>

      {/* District */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">District</Label>
          {value.district && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-md text-muted-foreground hover:text-destructive"
              onClick={() => onChange({ ...value, district: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <DistrictSelect
          value={value.district}
          onValueChange={(district) => {
            onChange({ ...value, district });
          }}
          regionId={value.region?.id}
          disabled={disabled || !value.region}
        />
      </div>
    </div>
  );
}
