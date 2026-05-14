import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  ColorInput,
  Container,
  Divider,
  Group,
  Image,
  LoadingOverlay,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import {
  IconClock,
  IconPhotoPlus,
  IconRefresh,
  IconTrash,
  IconUpload
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

type Ad = {
  id: string;
  title: string;
  imageUrl: string;
  durationSeconds: number;
  createdAt: string;
};

type Playlist = {
  updatedAt: string;
  ads: Ad[];
};

type EditorState = {
  title: string;
  durationSeconds: number;
  background: string;
  zoom: number;
  x: number;
  y: number;
};

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const API_BASE = import.meta.env.VITE_API_URL ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function absoluteAssetUrl(path: string) {
  if (!API_BASE) return path;
  return new URL(path, API_BASE).toString();
}

const defaultEditor: EditorState = {
  title: '',
  durationSeconds: 10,
  background: '#111827',
  zoom: 1,
  x: 0,
  y: 0
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [editor, setEditor] = useState<EditorState>(defaultEditor);
  const [sourceFileName, setSourceFileName] = useState('');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const totalRuntime = useMemo(
    () => playlist?.ads.reduce((sum, ad) => sum + ad.durationSeconds, 0) ?? 0,
    [playlist]
  );

  const refreshPlaylist = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(apiUrl('/api/playlist'));

    if (!response.ok) {
      throw new Error('Could not load playlist.');
    }

    setPlaylist(await response.json());
    setIsLoading(false);
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = editor.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const image = imageRef.current;
    if (!image) {
      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.font = '500 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload an image to compose a 16:9 ad', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      return;
    }

    const baseScale = Math.min(CANVAS_WIDTH / image.naturalWidth, CANVAS_HEIGHT / image.naturalHeight);
    const width = image.naturalWidth * baseScale * editor.zoom;
    const height = image.naturalHeight * baseScale * editor.zoom;
    const x = CANVAS_WIDTH / 2 - width / 2 + editor.x;
    const y = CANVAS_HEIGHT / 2 - height / 2 + editor.y;

    ctx.drawImage(image, x, y, width, height);
  }, [editor.background, editor.x, editor.y, editor.zoom]);

  useEffect(() => {
    refreshPlaylist().catch(() => {
      setIsLoading(false);
    });
  }, [refreshPlaylist]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const loadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      imageRef.current = image;
      setSourceFileName(file.name);
      setEditor((current) => ({
        ...current,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
        zoom: 1,
        x: 0,
        y: 0
      }));
    };

    image.src = url;
  };

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    };
  };

  const saveAd = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    setIsSaving(true);
    try {
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      const response = await fetch(apiUrl('/api/ads'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          title: editor.title || 'Untitled ad',
          durationSeconds: editor.durationSeconds
        })
      });

      if (!response.ok) throw new Error('Could not save ad.');

      setEditor(defaultEditor);
      setSourceFileName('');
      imageRef.current = null;
      await refreshPlaylist();
    } finally {
      setIsSaving(false);
    }
  };

  const updateAd = async (id: string, updates: Partial<Pick<Ad, 'durationSeconds' | 'title'>>) => {
    const response = await fetch(apiUrl(`/api/ads/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) return;
    await refreshPlaylist();
  };

  const deleteAd = async (id: string) => {
    const response = await fetch(apiUrl(`/api/ads/${id}`), { method: 'DELETE' });
    if (response.ok) await refreshPlaylist();
  };

  return (
    <AppShell header={{ height: 68 }} padding={0}>
      <AppShell.Header className="app-header">
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between">
            <Box>
              <Title order={2} size="h3">
                Dart Kiosk Studio
              </Title>
              <Text size="sm" c="dimmed">
                Compose ads, set runtimes, and publish to the kiosk playlist.
              </Text>
            </Box>
            <Group gap="xs">
              <Badge leftSection={<IconClock size={14} />} variant="light" color="teal">
                {playlist?.ads.length ?? 0} ads / {totalRuntime}s loop
              </Badge>
              <Tooltip label="Refresh playlist">
                <ActionIcon variant="default" size="lg" onClick={() => refreshPlaylist()}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" py="xl">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            <Stack gap="lg">
              <Paper p="md" withBorder className="editor-panel">
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Box>
                      <Title order={3} size="h4">
                        16:9 Composer
                      </Title>
                      <Text size="sm" c="dimmed">
                        Drag the preview to position the image.
                      </Text>
                    </Box>
                    {sourceFileName ? <Badge variant="light">{sourceFileName}</Badge> : null}
                  </Group>

                  <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="ad-canvas"
                    onPointerDown={(event) => {
                      dragRef.current = canvasPoint(event);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (!dragRef.current) return;
                      const point = canvasPoint(event);
                      const previous = dragRef.current;
                      dragRef.current = point;
                      setEditor((current) => ({
                        ...current,
                        x: current.x + point.x - previous.x,
                        y: current.y + point.y - previous.y
                      }));
                    }}
                    onPointerUp={() => {
                      dragRef.current = null;
                    }}
                    onPointerCancel={() => {
                      dragRef.current = null;
                    }}
                  />

                  <Dropzone
                    accept={IMAGE_MIME_TYPE}
                    maxFiles={1}
                    onDrop={(files) => loadFile(files[0])}
                    className="dropzone"
                  >
                    <Group justify="center" gap="sm" mih={76}>
                      <IconPhotoPlus size={24} />
                      <Box>
                        <Text fw={600}>Upload an image</Text>
                        <Text size="sm" c="dimmed">
                          PNG, JPG, or WebP. The saved ad is exported as a 1280x720 JPG.
                        </Text>
                      </Box>
                    </Group>
                  </Dropzone>
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Title order={3} size="h4">
                    Ad Settings
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Ad name"
                      value={editor.title}
                      onChange={(event) =>
                        setEditor((current) => ({ ...current, title: event.currentTarget.value }))
                      }
                      placeholder="Lunch special"
                    />
                    <NumberInput
                      label="Runtime"
                      min={1}
                      max={3600}
                      suffix=" seconds"
                      value={editor.durationSeconds}
                      onChange={(value) =>
                        setEditor((current) => ({
                          ...current,
                          durationSeconds: Number(value) || 1
                        }))
                      }
                    />
                  </SimpleGrid>

                  <ColorInput
                    label="Canvas background"
                    value={editor.background}
                    onChange={(value) => setEditor((current) => ({ ...current, background: value }))}
                    swatches={[
                      '#111827',
                      '#ffffff',
                      '#0f766e',
                      '#ef4444',
                      '#f59e0b',
                      '#2563eb',
                      '#18181b'
                    ]}
                  />

                  <Box>
                    <Text size="sm" fw={600} mb={6}>
                      Image scale
                    </Text>
                    <Slider
                      min={0.2}
                      max={3}
                      step={0.01}
                      value={editor.zoom}
                      onChange={(value) => setEditor((current) => ({ ...current, zoom: value }))}
                    />
                  </Box>

                  <Group justify="flex-end">
                    <Button
                      variant="default"
                      onClick={() => {
                        setEditor(defaultEditor);
                        setSourceFileName('');
                        imageRef.current = null;
                        drawCanvas();
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      leftSection={<IconUpload size={18} />}
                      disabled={!imageRef.current}
                      loading={isSaving}
                      onClick={saveAd}
                    >
                      Publish Ad
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>

            <Paper p="md" withBorder pos="relative" className="playlist-panel">
              <LoadingOverlay visible={isLoading} />
              <Stack gap="md" h="100%">
                <Group justify="space-between">
                  <Box>
                    <Title order={3} size="h4">
                      Playlist
                    </Title>
                    <Text size="sm" c="dimmed">
                      The kiosk loops through these ads in order.
                    </Text>
                  </Box>
                  {playlist?.updatedAt ? (
                    <Text size="xs" c="dimmed">
                      Updated {new Date(playlist.updatedAt).toLocaleTimeString()}
                    </Text>
                  ) : null}
                </Group>
                <Divider />

                <ScrollArea className="playlist-scroll">
                  <Stack gap="sm">
                    {playlist?.ads.length ? (
                      playlist.ads.map((ad) => (
                        <Card key={ad.id} withBorder p="sm" radius="sm">
                          <Group align="stretch" wrap="nowrap">
                            <Image
                              src={absoluteAssetUrl(ad.imageUrl)}
                              alt={ad.title}
                              className="playlist-thumb"
                              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23e5e7eb'/%3E%3C/svg%3E"
                            />
                            <Stack gap={8} flex={1}>
                              <TextInput
                                aria-label={`Title for ${ad.title}`}
                                value={ad.title}
                                onBlur={(event) => updateAd(ad.id, { title: event.currentTarget.value })}
                                onChange={(event) => {
                                  const title = event.currentTarget.value;
                                  setPlaylist((current) =>
                                    current
                                      ? {
                                          ...current,
                                          ads: current.ads.map((item) =>
                                            item.id === ad.id ? { ...item, title } : item
                                          )
                                        }
                                      : current
                                  );
                                }}
                              />
                              <Group gap="sm" align="end">
                                <NumberInput
                                  label="Runtime"
                                  min={1}
                                  max={3600}
                                  suffix=" sec"
                                  value={ad.durationSeconds}
                                  onChange={(value) =>
                                    updateAd(ad.id, { durationSeconds: Number(value) || 1 })
                                  }
                                  flex={1}
                                />
                                <Tooltip label="Remove ad">
                                  <ActionIcon
                                    color="red"
                                    variant="light"
                                    size="lg"
                                    onClick={() => deleteAd(ad.id)}
                                  >
                                    <IconTrash size={18} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Stack>
                          </Group>
                        </Card>
                      ))
                    ) : (
                      <Paper p="xl" withBorder className="empty-playlist">
                        <Stack align="center" gap={6}>
                          <IconPhotoPlus size={32} />
                          <Text fw={700}>No ads published</Text>
                          <Text c="dimmed" size="sm" ta="center">
                            Upload an image, compose the 16:9 frame, and publish it to start the loop.
                          </Text>
                        </Stack>
                      </Paper>
                    )}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
