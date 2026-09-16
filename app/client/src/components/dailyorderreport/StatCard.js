import React from 'react';
import { Card, Typography, Stack, Box } from '@mui/material';

const StatCard = ({ label, value, color = 'primary.main', icon = null }) => (
  <Card
    variant="outlined"
    sx={{ borderLeft: 4, borderLeftColor: color, height: '100%', px: 2, py: 1.75, }}
  >
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {icon && <Box sx={{ color: color, display: 'flex', alignItems: 'center' }}>{icon}</Box>}
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
    </Stack>
    <Typography variant="h5" sx={{ fontWeight: 600, mt: 0.25 }}>
      {value}
    </Typography>
  </Card>
);

export default StatCard;