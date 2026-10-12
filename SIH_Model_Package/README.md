# SIH RT-DETRv2-R18 inference package

Contains the exported model from the trained SIH checkpoint.

## Model classes
- COCO category ID 1: student
- COCO category ID 2: computer

## Contents
- model/: exported Paddle inference model and infer_cfg.yml
- deploy/python/: PaddleDetection deployment utilities
- classes.txt: class metadata

## Runtime requirements
This package does not include Python, PaddlePaddle, CUDA,
cuDNN, GPU drivers, or all third-party Python dependencies.
Install compatible dependencies on the deployment computer.

## Important
The original training checkpoint and dataset are not included.
Test the exported model with the intended runtime before deployment.
