import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Star } from 'lucide-react';

interface DoctorCardProps {
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  imageUrl: string;
}

export function DoctorCard({ name, specialty, rating, reviews, imageUrl }: DoctorCardProps) {
  return (
    <Card hoverable className="p-6 flex flex-col text-center">
      <div className="w-24 h-24 rounded-full overflow-hidden mb-4 mx-auto border-4 border-gray-50 shadow-sm bg-gray-100 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-sm">No Image</span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-blue-600 font-medium mb-4">{specialty}</p>
      
      <div className="flex items-center justify-center gap-1 mb-6 text-sm text-gray-600">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="font-medium text-gray-900">{rating}</span>
        <span>({reviews} reviews)</span>
      </div>
      
      <Button variant="outline" className="w-full mt-auto">Book Now</Button>
    </Card>
  );
}
